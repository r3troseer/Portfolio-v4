export const Experience = () => {
  const experiences = [
    {
      title: "ASP.NET Developer",
      company: "Touch and Pay Technologies Ltd (YC W22)",
      date: "January 2024 - January 2025",
      location: "Lagos, Nigeria",
      responsibilities: [
        "Developed and maintained backend systems using .NET technologies, achieving 20% improvement in application performance",
        "Implemented logic enhancements resulting in 50% increase in program efficiency",
        "Collaborated with frontend teams to enhance user experience by 35%",
        "Contributed innovative architectural improvements leading to 15% system enhancement",
      ],
    },
    {
      title: "Python Developer",
      company: "Reymage",
      date: "2021 - 2023",
      location: "Ibadan, Nigeria",
      responsibilities: [
        "Built web applications using Django framework, reducing server response times by 30%",
        "Designed RESTful APIs capable of handling 100,000 concurrent requests",
        "Improved code maintainability by 50% through clean coding practices",
        "Achieved 95% code coverage through comprehensive testing and code reviews",
        "Reduced critical defects by 60% through proactive bug identification and resolution",
      ],
    },
  ];
  return (
    <section id="experience">
      <div className="container">
        <h2 className="section-title fade-in">Professional Experience</h2>
        <div className="experience-timeline fade-in">
          {experiences?.map((exp, idx) => (
            <div className="experience-item" key={idx}>
              <h3>{exp.title}</h3>
              <div className="company">{exp.company}</div>
              <div className="date">
                {exp.date} | {exp.location}
              </div>
              <ul>
                {exp.responsibilities.map((responsibility, i) => (
                  <li key={i}>{responsibility}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
