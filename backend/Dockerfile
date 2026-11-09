FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY pom.xml ./
RUN mvn -B -ntp dependency:go-offline

COPY src ./src
RUN mvn -B -ntp -DskipTests package

FROM eclipse-temurin:21-jre-jammy AS runtime

RUN groupadd --system spring \
    && useradd --system --gid spring --no-create-home --shell /usr/sbin/nologin spring

WORKDIR /app
COPY --from=build --chown=spring:spring /workspace/target/backend-*.jar /app/app.jar

USER spring:spring

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
