# Architecture rules
- Keep the existing application's account/data service separate from the Cloud publishing bridge; enabling a publishing connector must not migrate existing users or data.
- Translate publishing providers at a shared adapter boundary used by interactive publishing and Autopilot, so provider-specific payloads do not diverge.