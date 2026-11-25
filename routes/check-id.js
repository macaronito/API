import { toWholeNumber } from '../utils/validation.js';

// Checks the :id in the address once for every endpoint in a router,
// then saves it on the request, e.g. req.learnerId.
const checkId = (name) => (req, res, next, value) => {
  const id = toWholeNumber(value);
  if (id === null) {
    return res.status(400).json({ message: `The ${name} ID must be a whole number of 1 or more.` });
  }
  req[`${name}Id`] = id;
  return next();
};

export default checkId;
