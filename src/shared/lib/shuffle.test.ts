import { shuffle } from "./shuffle";

it("returns a new array containing exactly the same elements", () => {
  const input = [1, 2, 3, 4, 5];
  const result = shuffle(input);
  expect(result).not.toBe(input);
  expect(result.slice().sort()).toEqual(input.slice().sort());
});

it("does not mutate the input array", () => {
  const input = [1, 2, 3];
  shuffle(input);
  expect(input).toEqual([1, 2, 3]);
});

it("returns an empty array unchanged", () => {
  expect(shuffle([])).toEqual([]);
});

it("is deterministic given an injected random function that always returns 0", () => {
  // Fisher-Yates from the end: with random() === 0, each step swaps the
  // current element with index 0. Tracing [1,2,3,4]: swap(3,0)->[4,2,3,1],
  // swap(2,0)->[3,2,4,1], swap(1,0)->[2,3,4,1].
  expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
});

it("keeps the original order when random always returns just under 1", () => {
  // floor(0.999999 * (i+1)) === i for every i in range, so every swap is a no-op.
  expect(shuffle([1, 2, 3, 4], () => 0.999999)).toEqual([1, 2, 3, 4]);
});
