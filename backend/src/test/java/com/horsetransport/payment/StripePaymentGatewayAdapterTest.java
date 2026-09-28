package com.horsetransport.payment;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class StripePaymentGatewayAdapterTest {

	@Test
	void rejectsMissingAndInvalidWebhookSignatures() {
		StripePaymentGatewayAdapter adapter = new StripePaymentGatewayAdapter(
				"sk_test_not_used", "whsec_test", "https://example.test/success", "https://example.test/cancel");

		assertThatThrownBy(() -> adapter.verifyAndParseWebhook("{}", null))
				.isInstanceOf(InvalidStripeWebhookException.class)
				.hasMessageContaining("required");
		assertThatThrownBy(() -> adapter.verifyAndParseWebhook("{}", "invalid"))
				.isInstanceOf(InvalidStripeWebhookException.class)
				.hasMessageContaining("invalid");
	}

	@Test
	void refusesStripeOperationsWhenSecretsAreNotConfigured() {
		StripePaymentGatewayAdapter adapter = new StripePaymentGatewayAdapter(
				"", "", "https://example.test/success", "https://example.test/cancel");

		assertThatThrownBy(() -> adapter.verifyAndParseWebhook("{}", "signature"))
				.isInstanceOf(StripeConfigurationException.class);
	}
}
