export const USER_SITES = Object.freeze([
  Object.freeze({ value: "gaiim", label: "GAIIM" }),
  Object.freeze({ value: "p1a", label: "P1A" }),
]);

export const formatSite = (siteValue) => {
  const site = USER_SITES.find(
    ({ value }) => value === siteValue,
  );

  return site?.label || siteValue || "";
};
