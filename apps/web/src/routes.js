import { index, layout, route } from "@react-router/dev/routes";

// Explicit Framework Mode routes for the public portfolio. No PB1 catch-all
// compatibility boundary - each surface owns its route module.
export default [
  layout("routes/site-layout.jsx", [
    index("routes/home.jsx"),
    route("playground", "routes/playground.jsx"),
    route("projects/:id", "routes/project-detail.jsx"),
    route("*", "routes/not-found.jsx"),
  ]),
];
