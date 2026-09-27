import { render } from "@testing-library/react";
import Page from "./page";

describe("scaffold smoke test", () => {
  it("renders the default page without crashing", () => {
    render(<Page />);
  });
});
