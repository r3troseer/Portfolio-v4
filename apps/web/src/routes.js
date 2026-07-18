import { route } from "@react-router/dev/routes";

// Compatibility boundary: one optional catch-all Framework Mode route renders
// the existing component-route App. Individual route modules are deferred.
export default [route("*?", "routes/spa.jsx")];
