// @flow

// finds the smallest value t of the list with t > min, t <= max
// returns null
export function findSmallestWithin(list : Array<number | null>, min : number, max : number, smallestSoFar : null | number = null) : null | number {
  if (list.length < 1) {
    return smallestSoFar;
  }
  else {
    const [head, ...tail] = list;
    if (head === null) {
      return findSmallestWithin(tail, min, max, smallestSoFar);
    }
    else if (head > min && head <= max) {
      if (smallestSoFar === null) {
        return findSmallestWithin(tail, min, max, head);
      }
      else if (head > smallestSoFar) {
        return findSmallestWithin(tail, min, max, smallestSoFar);
      }
      else {
        return findSmallestWithin(tail, min, max, head);
      }
    }
    else {
      return findSmallestWithin(tail, min, max, smallestSoFar);
    }
  }
};
