


//// util

interface AuthResult {
  auth: {
    password?: string;
    username?: string;
  };
  url: string;
}



//// export

export function extractAuthFromUrl(url: string): AuthResult {
  // For whatever reason, the `fetch` API does not convert credentials embedded in the URL
  // into Basic Authentication headers automatically. Instead it throws an error!
  // So we must manually parse the URL, rip out the user:password portion if it is present
  // and compute the Authorization header.
  // Note: I tried using new URL(url) but that throws a security exception in Edge. :rolleyes:
  const userpass = url.match(/^https?:\/\/([^/]+)@/);

  // No credentials, return the url unmodified and an empty auth object
  if (!userpass)
    return { auth: {}, url };

  const userpassString = userpass[1];
  const [username, password] = userpassString.split(":");

  // Remove credentials from URL
  url = url.replace(`${userpassString}@`, "");

  // Has credentials, return the fetch-safe URL and the parsed credentials
  return { auth: { password, username }, url };
}
