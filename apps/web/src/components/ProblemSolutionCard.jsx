import { Siren, SquareCheck } from "lucide-react";

export const ProblemSolutionCard = ({ problem, solution }) => {
  return (
    <div className="pf-pd-ps">
      <div className="pf-pd-ps-card">
        <span className="pf-pd-ps-tag">
          <Siren size={13} /> Problem
        </span>
        <h4>{problem.title}</h4>
        <p>
          <strong>Issue:</strong> {problem.issue}
        </p>
        <p>
          <strong>Impact:</strong> {problem.impact}
        </p>
      </div>
      <div className="pf-pd-ps-card pf-pd-solution">
        <span className="pf-pd-ps-tag">
          <SquareCheck size={13} /> Solution
        </span>
        <h4>{solution.title}</h4>
        <p>
          <strong>Implementation:</strong> {solution.implementation}
        </p>
        <p>
          <strong>Result:</strong> {solution.result}
        </p>
      </div>
    </div>
  );
};
