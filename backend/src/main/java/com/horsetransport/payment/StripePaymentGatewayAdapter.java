package com.horsetransport.payment;

import java.math.RoundingMode;
import java.util.Map;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.model.StripeObject;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class StripePaymentGatewayAdapter implements StripePaymentGateway {

	private final String secretKey;
	private final String webhookSecret;
	private final String successUrl;
	private final String cancelUrl;

	public StripePaymentGatewayAdapter(
			@Value("${app.payments.stripe.secret-key:}") String secretKey,
			@Value("${app.payments.stripe.webhook-secret:}") String webhookSecret,
			@Value("${app.payments.stripe.success-url}") String successUrl,
			@Value("${app.payments.stripe.cancel-url}") String cancelUrl) {
		this.secretKey = secretKey;
		this.webhookSecret = webhookSecret;
		this.successUrl = successUrl;
		this.cancelUrl = cancelUrl;
	}

	@Override
	public StripeCheckoutSession createCheckout(StripeCheckoutCommand command) {
		requireConfigured(secretKey, "Stripe secret key is not configured");
		long amountMinor = command.amount().setScale(2, RoundingMode.UNNECESSARY)
				.movePointRight(2).longValueExact();
		SessionCreateParams.PaymentIntentData paymentIntentData =
				SessionCreateParams.PaymentIntentData.builder().putAllMetadata(command.metadata()).build();
		SessionCreateParams.LineItem.PriceData.ProductData product =
				SessionCreateParams.LineItem.PriceData.ProductData.builder()
						.setName("Horse transport Deposit").build();
		SessionCreateParams.LineItem.PriceData price = SessionCreateParams.LineItem.PriceData.builder()
				.setCurrency(command.currency().toLowerCase())
				.setUnitAmount(amountMinor)
				.setProductData(product)
				.build();
		SessionCreateParams params = SessionCreateParams.builder()
				.setMode(SessionCreateParams.Mode.PAYMENT)
				.addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
				.setSuccessUrl(resolveUrl(successUrl, command.orderId().toString()))
				.setCancelUrl(resolveUrl(cancelUrl, command.orderId().toString()))
				.setClientReferenceId(command.orderId().toString())
				.putAllMetadata(command.metadata())
				.setPaymentIntentData(paymentIntentData)
				.addLineItem(SessionCreateParams.LineItem.builder().setQuantity(1L).setPriceData(price).build())
				.build();
		RequestOptions options = RequestOptions.builder().setApiKey(secretKey)
				.setIdempotencyKey(command.idempotencyKey()).build();
		try {
			Session session = Session.create(params, options);
			return new StripeCheckoutSession(session.getId(), session.getUrl(), session.getPaymentIntent());
		}
		catch (StripeException exception) {
			throw new DepositPaymentConflictException("Stripe Checkout could not be created");
		}
	}

	@Override
	public StripeWebhookEvent verifyAndParseWebhook(String payload, String signature) {
		requireConfigured(webhookSecret, "Stripe webhook secret is not configured");
		if (signature == null || signature.isBlank()) {
			throw new InvalidStripeWebhookException("Stripe-Signature header is required", null);
		}
		try {
			Event event = Webhook.constructEvent(payload, signature, webhookSecret);
			StripeObject object = event.getDataObjectDeserializer().getObject().orElse(null);
			return mapEvent(event, object);
		}
		catch (SignatureVerificationException exception) {
			throw new InvalidStripeWebhookException("Stripe webhook signature is invalid", exception);
		}
		catch (RuntimeException exception) {
			throw new InvalidStripeWebhookException("Stripe webhook payload is invalid", exception);
		}
	}

	private StripeWebhookEvent mapEvent(Event event, StripeObject object) {
		if (object instanceof Session session) {
			StripeEventKind kind = StripeEventKind.IGNORED;
			if ("checkout.session.completed".equals(event.getType())
					&& "paid".equals(session.getPaymentStatus())) {
				kind = StripeEventKind.SUCCESS;
			}
			else if ("checkout.session.expired".equals(event.getType())) {
				kind = StripeEventKind.EXPIRED;
			}
			return new StripeWebhookEvent(event.getId(), event.getType(), kind, session.getId(),
					session.getPaymentIntent(), session.getAmountTotal(), session.getCurrency(), safeMetadata(session.getMetadata()));
		}
		if (object instanceof PaymentIntent intent) {
			StripeEventKind kind = switch (event.getType()) {
				case "payment_intent.payment_failed" -> StripeEventKind.FAILED;
				case "payment_intent.canceled" -> StripeEventKind.CANCELLED;
				default -> StripeEventKind.IGNORED;
			};
			return new StripeWebhookEvent(event.getId(), event.getType(), kind, null, intent.getId(),
					intent.getAmount(), intent.getCurrency(), safeMetadata(intent.getMetadata()));
		}
		return new StripeWebhookEvent(event.getId(), event.getType(), StripeEventKind.IGNORED,
				null, null, null, null, Map.of());
	}

	private Map<String, String> safeMetadata(Map<String, String> metadata) {
		return metadata == null ? Map.of() : Map.copyOf(metadata);
	}

	private String resolveUrl(String template, String orderId) {
		return template.replace("{orderId}", orderId);
	}

	private void requireConfigured(String value, String message) {
		if (value == null || value.isBlank()) {
			throw new StripeConfigurationException(message);
		}
	}
}
