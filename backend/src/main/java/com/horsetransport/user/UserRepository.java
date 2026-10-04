package com.horsetransport.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import com.horsetransport.order.OrderStatus;
import com.horsetransport.order.StaffCandidateResponse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<UserAccount, UUID> {

	Optional<UserAccount> findByEmailIgnoreCase(String email);

	boolean existsByEmailIgnoreCase(String email);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select u from UserAccount u where u.id = :id")
	Optional<UserAccount> findByIdForUpdate(@Param("id") UUID id);

	@Query("select new com.horsetransport.order.StaffCandidateResponse(u.id, u.fullName, u.role, "
			+ "count(distinct o.id)) from UserAccount u "
			+ "left join OrderStaffAssignment a on a.userId = u.id "
			+ "left join TransportOrder o on o.id = a.transportOrderId and o.status in :activeStatuses "
			+ "where u.role = :role and u.status = com.horsetransport.user.UserStatus.ACTIVE "
			+ "group by u.id, u.fullName, u.role order by count(distinct o.id), u.id")
	List<StaffCandidateResponse> findActiveStaffCandidates(@Param("role") UserRole role,
			@Param("activeStatuses") List<OrderStatus> activeStatuses);
}
