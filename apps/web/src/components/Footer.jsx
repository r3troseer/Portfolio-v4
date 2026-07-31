import { getProfile } from "../content/adapters/profileAdapter";

export const Footer = () => {
  const { name } = getProfile();
  return (
    <footer>
      <div className="container">
        <p>&copy; {new Date().getFullYear()} {name}. Crafted with passion and code.</p>
      </div>
    </footer>
  );
};
