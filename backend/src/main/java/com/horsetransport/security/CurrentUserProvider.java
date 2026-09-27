package com.horsetransport.security;

import java.util.UUID;

import com.horsetransport.user.UserRole;

public interface CurrentUserProvider {

	UUID getCurrentUserId();

	UserRole getCurrentUserRole();
}
