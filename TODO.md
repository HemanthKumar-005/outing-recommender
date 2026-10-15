# Project Roadmap & Backlog (TODO)

This document tracks future enhancements and optional operational items for the **Outing Recommender Platform**.

> ℹ️ **Looking for completed tasks?**
> All primary functional requirements, machine learning engines, routing integrations, sentiment NLP transformers, and Pan-India catalog expansion have been fully implemented and verified.
> Detailed documentation is maintained in [**`DONE.md`**](./DONE.md) and [**`2026-10-15.md`**](./2026-10-15.md).

---

## 🏁 1. Core Milestone Completion Status

| Subsystem / Layer | Priority | Milestone Status | Completed Implementation |
| :--- | :---: | :---: | :--- |
| **NLP Transformer Sentiment Worker** | High | ✅ **DONE** (2026-10-15) | DistilBERT local transformer pipeline, continuous polarity, atmosphere extraction, and `ReviewSource` abstractions (`11/11 tests passing`) |
| **POI Venue Catalog Expansion** | High | ✅ **DONE** (2026-10-15) | Scaled catalog to 3,534 venues across 93 Indian cities in 33 states/UTs, 10,692 companion reviews, and database upsert sync |

---

## 🔮 2. Future Operational & Production Enhancements (Optional Backlog)

The following items are optional non-functional / operational extensions for live deployment:

### 🌐 Domain & SSL Provisioning
* **Status**: Optional / Backlog
* **Scope**:
  - Point public DNS domain (e.g., `outing.example.com`) to production VPS / cloud load balancer.
  - Run `certbot` container in `deploy/docker-compose.prod.yml` to issue Let's Encrypt TLS certificates.
  - Verify automatic SSL renewal cron.

### 📈 External Observability & APM
* **Status**: Optional / Backlog
* **Scope**:
  - Prometheus and Grafana dashboards for API Gateway latency, throughput, and error rates.
  - Sentry or OpenTelemetry instrumentation for distributed tracing across microservices.

### 📱 Native Mobile Client (React Native / Flutter)
* **Status**: Optional / Backlog
* **Scope**:
  - Package existing responsive Next.js frontend or create cross-platform mobile app leveraging existing REST APIs.
