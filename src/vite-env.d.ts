/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The API's origin, with no path: the generated paths already begin with
   * `/api/v1`. Unset, the console talks to the deployed instance.
   */
  readonly VITE_API_BASE_URL?: string;
  /**
   * `live` sends the dev server's requests to the API. Anything else, or unset,
   * answers them from the mock. Production builds never load the mock.
   */
  readonly VITE_API_MODE?: string;
}
