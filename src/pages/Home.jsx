import { useEffect } from "react";
import { useLocation } from "react-router";
import { Navigation } from "../components/Navigation";
import { Hero } from "../components/Hero";
import { About } from "../components/About";
import { Projects } from "../components/Projects";
import { Experience } from "../components/Experience";
import { Contact } from "../components/Contact";
// import { Footer } from "../components/Footer";
import { ParticleEffect } from "../components/ParticleEffect";

export function Home() {
  const { state } = useLocation();

  useEffect(() => {
    if (state?.scrollTo) {
      const element = document.getElementById(state.scrollTo);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [state]);

  useEffect(() => {
    // Fade in animation on scroll
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px",
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    }, observerOptions);

    document.querySelectorAll(".fade-in").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Navigation />
      <Hero />
      <About />
      <Projects />
      <Experience />
      <Contact />
      <ParticleEffect />
    </>
  );
}
