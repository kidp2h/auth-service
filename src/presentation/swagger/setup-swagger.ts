import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Name of the security scheme; @ApiBearerAuth(BEARER_AUTH) refers to it.
export const BEARER_AUTH = 'access-token';

// Runs in the Swagger UI page. After a successful register, login or refresh it
// takes the returned access token and fills the Authorize dialog, so protected
// endpoints (logout) work right away without copy-pasting the token.
const AUTO_AUTHORIZE_JS = `
(function () {
  var SCHEME = '${BEARER_AUTH}';
  var TOKEN_ENDPOINTS = /\\/auth\\/(register|login|refresh)$/;
  var originalFetch = window.fetch;
  window.fetch = function () {
    var input = arguments[0];
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var promise = originalFetch.apply(this, arguments);
    if (TOKEN_ENDPOINTS.test(url.split('?')[0])) {
      promise.then(function (response) {
        if (!response.ok) return;
        response.clone().json().then(function (body) {
          var token = body && body.data && body.data.accessToken;
          if (token && window.ui) {
            window.ui.preauthorizeApiKey(SCHEME, token);
            // preauthorizeApiKey does not trigger persistAuthorization, so store
            // the state under the key Swagger UI restores on page load.
            try {
              localStorage.setItem('authorized', JSON.stringify(window.ui.authSelectors.authorized().toJS()));
            } catch (e) {}
          }
        }).catch(function () {});
      }).catch(function () {});
    }
    return promise;
  };
})();
`;

/**
 * Registers the Swagger UI. Only called when SWAGGER_ENABLED=true, which is set
 * for dev alone: everywhere else the routes do not exist (404).
 */
export function setupSwagger(app: INestApplication, path = 'auth/docs'): void {
  const config = new DocumentBuilder()
    .setTitle('Auth Service API')
    .setDescription(
      [
        'Accounts and sessions.',
        '',
        '**How to try the protected endpoints:** call `POST /auth/register` or `POST /auth/login` here; the returned access token fills the **Authorize** dialog automatically (or paste one yourself). Access tokens last 15 minutes; use `POST /auth/refresh` to get a new one.',
        '',
        'Every successful response is wrapped as `{ "status": <http status>, "data": ... }`; errors are `{ "status", "error", "message" }`.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Access token from /auth/login, /auth/register or /auth/refresh. Paste the token only, without the "Bearer " prefix.',
      },
      BEARER_AUTH,
    )
    .build();

  SwaggerModule.setup(path, app, SwaggerModule.createDocument(app, config), {
    customSiteTitle: 'Auth Service API',
    customJsStr: AUTO_AUTHORIZE_JS,
    swaggerOptions: {
      // Keep the token across page reloads (it expires after 15 minutes).
      persistAuthorization: true,
      displayRequestDuration: true,
      tagsSorter: 'alpha',
    },
  });
}
