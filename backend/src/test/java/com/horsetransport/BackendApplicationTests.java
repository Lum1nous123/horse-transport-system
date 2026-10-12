package com.horsetransport;

import com.horsetransport.horse.HorseRepository;
import com.horsetransport.document.HorseDocumentRepository;
import com.horsetransport.document.HorseDocumentVersionRepository;
import com.horsetransport.audit.StatusAuditLogRepository;
import com.horsetransport.order.TransportOrderRepository;
import com.horsetransport.payment.PaymentAttemptRepository;
import com.horsetransport.payment.PaymentProviderEventRepository;
import com.horsetransport.payment.PaymentRepository;
import com.horsetransport.quotation.QuotationRepository;
import com.horsetransport.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.horsetransport.route.CheckpointRepository;
import com.horsetransport.route.AirLegExecutionRepository;
import com.horsetransport.route.RoutePlanRepository;
import com.horsetransport.route.RoutePlanReviewRepository;
import com.horsetransport.route.RouteLegRepository;
import com.horsetransport.route.RoadLegVehicleHorseRepository;
import com.horsetransport.route.RoadLegVehicleRepository;
import com.horsetransport.route.RoadVehicleExecutionRepository;
import com.horsetransport.route.VehicleRepository;


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
	private HorseDocumentRepository horseDocumentRepository;

	@MockitoBean
	private HorseDocumentVersionRepository horseDocumentVersionRepository;

	@MockitoBean
	private TransportOrderRepository transportOrderRepository;

	@MockitoBean
	private StatusAuditLogRepository statusAuditLogRepository;

	@MockitoBean
	private QuotationRepository quotationRepository;

	@MockitoBean
	private PaymentRepository paymentRepository;

	@MockitoBean
	private PaymentAttemptRepository paymentAttemptRepository;

	@MockitoBean
	private PaymentProviderEventRepository paymentProviderEventRepository;

	@MockitoBean
	private RoutePlanRepository routePlanRepository;

	@MockitoBean
	private RoutePlanReviewRepository routePlanReviewRepository;

	@MockitoBean
	private UserRepository userRepository;

	@MockitoBean
	private RouteLegRepository routeLegRepository;

	@MockitoBean
    private VehicleRepository vehicleRepository;

    @MockitoBean
    private RoadLegVehicleRepository roadLegVehicleRepository;

    @MockitoBean
    private RoadLegVehicleHorseRepository roadLegVehicleHorseRepository;

	@MockitoBean
	private RoadVehicleExecutionRepository roadVehicleExecutionRepository;

	@MockitoBean
	private AirLegExecutionRepository airLegExecutionRepository;

	@MockitoBean
	private CheckpointRepository checkpointRepository;

	@Test
	void contextLoads() {
	}

}
