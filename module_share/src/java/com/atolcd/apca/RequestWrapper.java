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
	private String stringRequest;
	
	public RequestWrapper(HttpServletRequest request) {
		super(request);
		this.stringRequest="";
	}

    /**
     * Surchage de la m�thode getInputStream(). Retourne un nouvel inputStream
     * cr�� � partir de stringRequest, plut�t que de renvoyer l'inputStream
     * courant, qui pourrait d�j� avoir �t� lu.
     */
    @Override
    public ServletInputStream getInputStream ()
        throws IOException {
    	ServletInputStream inputStream;
    	if(!this.stringRequest.isEmpty()){
	        final ByteArrayInputStream byteArrayInputStream = new ByteArrayInputStream(stringRequest.getBytes());
	        //cf javadoc.
	        inputStream = new ServletInputStream() {
	            @Override
				public int read ()
	                throws IOException {
	            	try{
	            		return byteArrayInputStream.read();
	            	}
	            	catch(Exception e){
	            		e.printStackTrace();
	            		return 0;
	            	}
	            }
	        };
    	}
    	else 
    		inputStream = this.getRequest().getInputStream();
    	
        return inputStream;
    }
    
    public void buildStringContent(){
		StringBuilder stringBuilder = new StringBuilder();
        BufferedReader bufferedReader = null;
        try {
        	//Premi�re lecture de la requ�te
            InputStream inputStream = this.getRequest().getInputStream();
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
        this.stringRequest = stringBuilder.toString();	
    	
    }
    
    public String getStringContent(){
    	if(this.stringRequest.isEmpty()){
    		this.buildStringContent();
    	}
    	return this.stringRequest;
    }
}
