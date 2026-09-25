package com.horsetransport;

import com.horsetransport.horse.HorseRepository;
import com.horsetransport.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(properties = {
		"app.security.jwt.secret=01234567890123456789012345678901",
		"spring.autoconfigure.exclude="
				+ "org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration,"
				+ "org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration,"
				+ "org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration,"
				+ "org.springframework.boot.data.jpa.autoconfigure.DataJpaRepositoriesAutoConfiguration"
})
class BackendApplicationTests {

	@MockitoBean
	private HorseRepository horseRepository;

	@MockitoBean
	private UserRepository userRepository;

	@Test
	void contextLoads() {
	}

}
