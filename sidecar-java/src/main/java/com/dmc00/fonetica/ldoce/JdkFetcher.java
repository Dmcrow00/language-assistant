package com.dmc00.fonetica.ldoce;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * {@link Fetcher} con el cliente HTTP de Java. Sigue las redirecciones (Longman redirige la búsqueda a la
 * página de la palabra o a la de sugerencias) y usa el proxy del sistema, como hacía Electron.
 */
public class JdkFetcher implements Fetcher {

    private static final Duration TIMEOUT = Duration.ofSeconds(30);

    private final HttpClient client = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(15))
            .build();
    /** El mismo User-Agent que mandaba Electron (lo pasa al lanzar el motor); null = el de Java. */
    private final String userAgent;

    public JdkFetcher(String userAgent) {
        this.userAgent = userAgent;
    }

    @Override
    public Response fetch(String url, Map<String, String> headers) throws IOException, InterruptedException {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(url)).timeout(TIMEOUT).GET();
        if (userAgent != null && !userAgent.isBlank()) request.header("User-Agent", userAgent);
        headers.forEach(request::header);
        HttpResponse<byte[]> response = client.send(request.build(), HttpResponse.BodyHandlers.ofByteArray());
        return new Response(
                response.statusCode(),
                response.uri().toString(),
                response.headers().firstValue("Content-Type").orElse(null),
                response.body());
    }
}
