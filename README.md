# 🚀 AtomQuest Performance Portal
### *Full-Stack Adaptive Corporate Goal-Setting & Performance Management Tracking System*

An enterprise-grade, full-stack performance management ecosystem designed to eliminate administrative bottlenecks, align individual contributions with organizational goals, and provide real-time workflow transparency across an entire enterprise.

---

## 💡 Key Architectural Innovations

* **Dynamic Weightage Balancer:** Features an interactive frontend alignment system that enforces strict mathematical compliance ($Total = 100\%$) across highly custom, target-driven KPIs.
* **Unit of Measure (UoM) Adaptability:** Dynamically alters UI inputs and backend validation formulas based on selected metrics (e.g., Higher-is-better for Sales Targets vs. Lower-is-better for operational TAT and costs).
* **Dual-Layer Hackathon Presentation Layer:** Includes a top-mounted live-state simulation panel. This allows judges to instantaneously toggle between Employee, Manager, and Admin persona screens in real-time without losing system state or token stability.
* **Enterprise Security & Audit Trail:** Built on robust database constraints that handle lifecycle locks. The system generates automatic audit captures to maintain a post-lock paper trail for corporate compliance.

---

## 📁 Repository Structure

This repository contains the complete full-stack architecture organized cleanly into decoupled frontend and backend environments:

```text
📁 atomquest-performance-portal (Root)
 ├── 📁 frontend/           # React SPA interface built with Vite
 │    ├── 📁 src/
 │    │    ├── 📁 components/ # Dedicated views for Admin, Manager, and Employee
 │    │    └── 📁 hooks/      # Custom state tracking and application layer data streams
 │    └── package.json
 └── 📁 backend/            # Enterprise API Engine & Transactional Schemas
      ├── server.js         # Core backend server and API routing architecture
      └── package.json
