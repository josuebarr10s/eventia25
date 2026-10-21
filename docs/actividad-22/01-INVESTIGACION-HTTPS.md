# Investigación de HTTPS

**Fecha de comprobación:** 21 de octubre de 2026, 22:42 UTC. La medición se hizo desde el entorno de trabajo disponible y describe las respuestas de esa ruta de red; un CDN puede servir otros certificados o códigos en otro momento o punto de presencia.

## Resultado comparativo

| Aspecto | INTECAP | Walmart Guatemala |
|---|---|---|
| Nombre y URL | INTECAP, `https://intecap.edu.gt/` | Walmart Guatemala, dirección canónica observada `https://www.walmart.com.gt/` |
| ¿Utiliza HTTPS? | Sí; respuesta final 200 | Sí; `https://walmart.com.gt/` redirige a `https://www.walmart.com.gt/` y la dirección canónica respondió 200 |
| Certificado válido | Sí, verificación de cadena y nombre correcta con almacén de CA del sistema | Sí, verificación de cadena y nombre correcta en el dominio canónico y en el dominio raíz |
| Dominio del certificado | SAN: `intecap.edu.gt`, `*.intecap.edu.gt` | Certificado canónico: `www.walmart.com.gt`, `walmart.com.gt`. El certificado raíz observado cubría `walmart.com.gt` |
| Emisor directo | Let's Encrypt, `YR1` | GlobalSign nv-sa, `GlobalSign GCC R46 OV TLS CA 2025` |
| Vencimiento exacto | 1 de diciembre de 2026, 06:09:39 GMT | Certificado de `www`: 20 de marzo de 2027, 16:53:22 GMT. Certificado del dominio raíz: 21 de febrero de 2027, 15:33:10 GMT |
| HTTP redirige a HTTPS | `http://intecap.edu.gt/`: 301 permanente; destino HTTPS, 200 final | `http://www.walmart.com.gt/`: 301 permanente a HTTPS, 200 final. `http://walmart.com.gt/` respondió 404 desde el punto de red observado; no redirigió en esa medición |
| Protocolo HTTP | Las respuestas HTTPS finales negociaron HTTP/2 con curl `--http2`; TLS fue 1.3 | Las respuestas HTTPS finales negociaron HTTP/2 con curl `--http2`; TLS fue 1.3 |
| Observaciones | El certificado fue validado con TLS/hostname verification. ALPN no fue negociado en la conexión Python; la negociación HTTP/2 se observó por separado en curl | La raíz HTTPS redirige a `www`. La respuesta HTTP de la raíz fue diferente a la de `www`; conviene comprobar el comportamiento desde otros puntos antes de generalizar |

## Evidencia y método

Se consultaron las URL HTTP y HTTPS con `curl -sSIL --max-time 20 --http2`, siguiendo redirecciones y registrando las líneas de estado y `Location`. Se abrió cada sitio en el navegador integrado para confirmar que la página se cargaba y revisar su dirección final: INTECAP mostró “INTECAP | ¡Te cambia la vida!” y Walmart “Walmart | Comprá Online | Entrega a Domicilio Rápida y Segura”. La inspección del certificado se confirmó con una conexión TLS de Python usando `ssl.create_default_context()` y SNI; por ello, la validez indicada es una comprobación del cliente local con validación de CA y hostname, no una afirmación basada solo en el candado visual.

Comandos reproducibles (sin escaneo ni carga):

```sh
curl -sSIL --max-time 20 --http2 https://intecap.edu.gt/
curl -sSIL --max-time 20 --http2 http://intecap.edu.gt/
curl -sSIL --max-time 20 --http2 https://walmart.com.gt/
curl -sSIL --max-time 20 --http2 http://www.walmart.com.gt/
```

La comprobación TLS obtuvo TLS 1.3 y `verify=OK` para `intecap.edu.gt`, `walmart.com.gt` y `www.walmart.com.gt`. Los emisores anotados son los **emisores directos** que aparecen en los certificados de hoja; no se presentan como autoridades raíz. No se guardó captura, HAR ni una exportación de DevTools Network. El protocolo HTTP/2 se atribuye a la negociación de curl, no a Network del navegador. Las fechas de vencimiento son válidas a la fecha de esta consulta y pueden cambiar cuando los sitios renueven certificados.
