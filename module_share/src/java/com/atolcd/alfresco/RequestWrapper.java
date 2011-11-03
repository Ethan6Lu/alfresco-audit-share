package com.atolcd.alfresco;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;

import javax.servlet.ServletInputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletRequestWrapper;

/**
 * @author ani
 * 
 *         Surchage du HttpServletRequestWrapper A la base, l'inputStream ne
 *         peut être lu qu'une seule fois. Il était donc impossible d'auditer
 *         les données postées d'Alfresco. La méthode getInputStream() est
 *         surchargée pour retourner un nouvel inputStream à chaque appel. C'est
 *         un objet de cette classe qui est envoyé dans le doFilter ensuite.
 */
public class RequestWrapper extends HttpServletRequestWrapper {
	private String stringRequest;

	public RequestWrapper(HttpServletRequest request) {
		super(request);
		this.stringRequest = "";
	}

	/**
	 * Surchage de la méthode getInputStream(). Retourne un nouvel inputStream
	 * créé à partir de stringRequest, plutôt que de renvoyer l'inputStream
	 * courant, qui pourrait déjà avoir été lu.
	 */
	@Override
	public ServletInputStream getInputStream() throws IOException {
		ServletInputStream inputStream;
		if (!this.stringRequest.isEmpty()) {
			final ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(
					stringRequest.getBytes());
			// cf javadoc.
			inputStream = new ServletInputStream() {
				@Override
				public int read() throws IOException {
					try {
						return byteArrayInputStream.read();
					} catch (Exception e) {
						e.printStackTrace();
						return 0;
					}
				}
			};
		} else
			inputStream = this.getRequest().getInputStream();

		return inputStream;
	}

	public void buildStringContent() {
		StringBuilder stringBuilder = new StringBuilder();
		BufferedReader bufferedReader = null;
		try {
			// Première lecture de la requête
			InputStream inputStream = this.getRequest().getInputStream();
			if (inputStream != null) {
				bufferedReader = new BufferedReader(new InputStreamReader(
						inputStream));
				char[] charBuffer = new char[128];
				int bytesRead = -1;
				while ((bytesRead = bufferedReader.read(charBuffer)) > 0) {
					stringBuilder.append(charBuffer, 0, bytesRead);
				}
			} else {
				stringBuilder.append("");
			}
		} catch (IOException ex) {
			ex.printStackTrace();
		} finally {
			if (bufferedReader != null) {
				try {
					bufferedReader.close();
				} catch (IOException iox) {
					// ignore
				}
			}
		}
		// On conserve la requête sous forme de String
		this.stringRequest = stringBuilder.toString();

	}

	public String getStringContent() {
		if (this.stringRequest.isEmpty()) {
			this.buildStringContent();
		}
		return this.stringRequest;
	}
}
