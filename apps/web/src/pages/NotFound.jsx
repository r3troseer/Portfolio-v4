import { Link } from "react-router";
import "../styles/projectDetail.css";

export const NotFound = () => {
  return (
    <section className="not-found">
      <div className="container">
        <p>404</p>
        <h2>Page not found</h2>
        <Link to="/" className="cta-button">Back to home</Link>
      </div>
    </section>
  );
};
