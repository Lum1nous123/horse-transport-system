package com.horsetransport.security;

import java.util.UUID;

public interface CurrentUserProvider {

	UUID getCurrentUserId();
}
