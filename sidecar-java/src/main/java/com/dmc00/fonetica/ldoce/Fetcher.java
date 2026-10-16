package com.dmc00.fonetica.ldoce;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Lo mínimo que el cliente de Longman necesita de HTTP, para poder probarlo sin red. */
public interface Fetcher {

    Response fetch(String url, Map<String, String> headers) throws IOException, InterruptedException;

    /**
     * @param url         la URL final, después de las redirecciones
     * @param contentType el encabezado Content-Type, o null
     */
    record Response(int status, String url, String contentType, byte[] body) {

        private static final Pattern CHARSET = Pattern.compile("charset=\"?([^\";\\s]+)", Pattern.CASE_INSENSITIVE);

        public boolean ok() {
            return status >= 200 && status <= 299;
        }

        /** El cuerpo como texto, con el charset del Content-Type (UTF-8 si no dice). */
        public String text() {
            Charset charset = StandardCharsets.UTF_8;
            if (contentType != null) {
                Matcher m = CHARSET.matcher(contentType);
                if (m.find() && Charset.isSupported(m.group(1))) charset = Charset.forName(m.group(1));
            }
            return new String(body, charset);
        }
    }
}
