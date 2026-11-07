// Development builds add 1- and 2-minute limits so limits can be tested without waiting.
export const LIMIT_CHOICES = [...(__DEV__ ? [1, 2] : []), 15, 30, 45, 60, 90, 120];

// The "All adult websites" rule on Android: Private DNS pointed at a family filter.
export const ADULT_DNS_HOST = "family.cloudflare-dns.com";
