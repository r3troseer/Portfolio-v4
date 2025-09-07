export const PageHeader = ({ head, description }) => {
  return (
    <header className="page-header">
      <div className="container">
        <h1>{head}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
};
