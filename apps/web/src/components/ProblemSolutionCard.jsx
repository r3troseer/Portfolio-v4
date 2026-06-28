import { Siren, SquareCheck } from "lucide-react";

export const ProblemSolutionCard = ({ problem, solution }) => {
  return (
    <div className="problem-solution">
      <div className="problem-card">
        <h4>
          <Siren className="icon" />
          &nbsp;&nbsp;
          {problem.title}
        </h4>
        <p>
          <strong>Issue:</strong> {problem.issue}
        </p>
        <p>
          <strong>Impact:</strong> {problem.impact}
        </p>
      </div>
      <div className="solution-card">
        <h4>
          <SquareCheck className="icon" />
          &nbsp;&nbsp;
          {solution.title}
        </h4>
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
