export function shouldEnableMeQuery({
  isLoaded,
  isSignedIn,
}: {
  isLoaded: boolean | undefined;
  isSignedIn: boolean | undefined;
}) {
  return !!isLoaded && !!isSignedIn;
}