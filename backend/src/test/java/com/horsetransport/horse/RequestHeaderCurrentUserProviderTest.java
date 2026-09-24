package com.horsetransport.horse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.mock.web.MockHttpServletRequest;

class RequestHeaderCurrentUserProviderTest {

	@Test
	void activatesOnlyForLocalProfile() {
		try (AnnotationConfigApplicationContext localContext = contextWithProfile("local");
				AnnotationConfigApplicationContext productionContext = contextWithProfile("production")) {
			assertThat(localContext.getBeansOfType(CurrentUserProvider.class)).hasSize(1);
			assertThat(productionContext.getBeansOfType(CurrentUserProvider.class)).isEmpty();
		}
	}

	@Test
	void readsCurrentUserIdFromLocalRequestHeader() {
		UUID customerId = UUID.fromString("11111111-1111-1111-1111-111111111111");
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.addHeader(RequestHeaderCurrentUserProvider.CURRENT_USER_HEADER, customerId.toString());

		RequestHeaderCurrentUserProvider provider = new RequestHeaderCurrentUserProvider(request);

		assertThat(provider.getCurrentUserId()).isEqualTo(customerId);
	}

	@Test
	void rejectsMissingCurrentUserHeader() {
		RequestHeaderCurrentUserProvider provider =
				new RequestHeaderCurrentUserProvider(new MockHttpServletRequest());

		assertThatThrownBy(provider::getCurrentUserId)
				.isInstanceOf(CurrentUserUnavailableException.class)
				.hasMessageContaining(RequestHeaderCurrentUserProvider.CURRENT_USER_HEADER);
	}

	@Test
	void rejectsInvalidCurrentUserHeader() {
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.addHeader(RequestHeaderCurrentUserProvider.CURRENT_USER_HEADER, "not-a-uuid");
		RequestHeaderCurrentUserProvider provider = new RequestHeaderCurrentUserProvider(request);

		assertThatThrownBy(provider::getCurrentUserId)
				.isInstanceOf(CurrentUserUnavailableException.class)
				.hasMessageContaining("valid UUID");
	}

	private AnnotationConfigApplicationContext contextWithProfile(String profile) {
		AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
		context.getEnvironment().setActiveProfiles(profile);
		context.getBeanFactory().registerSingleton("httpServletRequest", new MockHttpServletRequest());
		context.register(RequestHeaderCurrentUserProvider.class);
		context.refresh();
		return context;
	}

}
