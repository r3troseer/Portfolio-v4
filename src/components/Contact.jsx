export const Contact = () => {
  const contacts = [
    {
      title: "Email",
      value: "peecody1@gmail.com",
      href: "mailto:peecody1@gmail.com",
    },
    {
      title: "LinkedIn",
      value: "pius-agboola",
      href: "https://linkedin.com/in/pius-agboola",
      target: "_blank",
      rel: "noopener noreferrer",
    },
    {
      title: "GitHub",
      value: "r3troseer",
      href: "https://github.com/r3troseer",
      target: "_blank",
      rel: "noopener noreferrer",
    },
  ];
  return (
    <section id="contact">
      <div className="container">
        <h2 className="section-title fade-in">Let's Connect</h2>
        <div className="contact-content fade-in">
          <p>
            I'm always open to discussing new opportunities and interesting
            projects. Feel free to reach out if you'd like to collaborate!
          </p>
          <div className="contact-info">
            {contacts?.map((contact, idx) => (
              <a
                href={contact.href}
                className="contact-item"
                key={contact.title}
                target={contact.target}
                rel={contact.rel}
              >
                <h4>{contact.title}</h4>
                <p>{contact.value}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
