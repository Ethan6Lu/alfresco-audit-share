package com.atolcd.apca;

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
 * Surchage du HttpServletRequestWrapper
 * A la base, l'inputStream ne peut �tre lu qu'une seule fois. Il �tait donc
 * impossible d'auditer les donn�es post�es d'Alfresco. La m�thode getInputStream()
 * est surcharg�e pour retourner un nouvel inputStream � chaque appel.
 * C'est un objet de cette classe qui est envoy� dans le doFilter ensuite.
 */
public class RequestWrapper extends HttpServletRequestWrapper {
	private final String stringRequest;
	public RequestWrapper(HttpServletRequest request) {
		super(request);

		
        StringBuilder stringBuilder = new StringBuilder();
        BufferedReader bufferedReader = null;
        try {
        	//Premi�re lecture de la requ�te
            InputStream inputStream = request.getInputStream();
            if (inputStream != null) {
                bufferedReader = new BufferedReader(new InputStreamReader(inputStream));
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
        //On conserve la requ�te sous forme de String
        stringRequest = stringBuilder.toString();
	}

    /**
     * Surchage de la m�thode getInputStream(). Retourne un nouvel inputStream
     * cr�� � partir de stringRequest, plut�t que de renvoyer l'inputStream
     * courant, qui pourrait d�j� avoir �t� lu.
     */
    @Override
    public ServletInputStream getInputStream ()
        throws IOException {
    	
        final ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(stringRequest.getBytes());
        //cf javadoc.
        ServletInputStream inputStream = new ServletInputStream() {
            public int read ()
                throws IOException {
            	try{
            		return byteArrayInputStream.read();
            	}
            	catch(Exception e){
            		System.out.println("Erreur :<");
            		return 0;
            	}
            }
        };
        return inputStream;
    }
    
    public String getStringContent(){
    	return this.stringRequest;
    }
}
