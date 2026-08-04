const SITES = Object.freeze([
  Object.freeze({ value: "gaiim", label: "GAIIM" }),
  Object.freeze({ value: "p1a", label: "P1A" }),
]);

const VALID_SITES = Object.freeze(SITES.map((site) => site.value));
const DEFAULT_SITE = VALID_SITES[0];

module.exports = {
  SITES,
  VALID_SITES,
  DEFAULT_SITE,
};
