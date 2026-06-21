import { getProfile } from "../content/adapters/profileAdapter";

export const Footer = () => {
  const { name } = getProfile();
  return (
    <footer>
      <div className="container">
        <p>&copy; 2025 {name}. Crafted with passion and code.</p>
      </div>
    </footer>
  );
};
