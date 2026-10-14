const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Variables de entorno o tus credenciales directas para pruebas (Sandbox)
const DHL_API_KEY = process.env.DHL_API_KEY || 'TU_API_KEY_DE_DHL';
const DHL_API_SECRET = process.env.DHL_API_SECRET || 'TU_API_SECRET_DE_DHL';
const DHL_ACCOUNT_NUMBER = process.env.DHL_ACCOUNT_NUMBER || 'TU_NUMERO_DE_CUENTA_DHL';
const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || 'TU_TOKEN_DE_HUBSPOT';

app.post('/webhook-hubspot', async (req, res) => {
  try {
    // 1. Recibir los datos enviados por el Webhook de HubSpot
    const payload = req.body;
    const properties = payload.properties || payload;
    
    const dealId = payload.objectId || properties.hs_object_id;
    const recipientName = properties.firstname || properties.contact_name || "Cliente";
    const address = properties.address || "Direccion Principal";
    const city = properties.city || "Ciudad";
    const postalCode = properties.zip || "10101";
    const countryCode = properties.country || "MX";
    const weight = parseFloat(properties.peso_envio || 1.0);

    console.log(`Procesando envío para el negocio/deal ID: ${dealId}`);

    // 2. Construir la solicitud hacia la API de MyDHL Express (Entorno Sandbox)
    const dhlPayload = {
      plannedShippingDateAndTime: new Date(Date.now() + 3600 * 1000).toISOString().replace(/\.\d{3}/, ''),
      pickup: { isRequested: false },
      productCode: "P", // "P" es para Express Worldwide / Estándar Express
      accounts: [{ typeCode: "shipping", number: DHL_ACCOUNT_NUMBER }],
      customerDetails: {
        shipperDetails: {
          postalAddress: {
            postalCode: "01000",
            cityName: "Ciudad de Mexico",
            countryCode: "MX",
            addressLine1: "Calle de Origen 123"
          },
          contactInformation: {
            fullName: "Mi Empresa",
            companyName: "Mi Empresa S.A.",
            phone: "+525555555555",
            email: "envios@miempresa.com"
          }
        },
        receiverDetails: {
          postalAddress: {
            postalCode: postalCode,
            cityName: city,
            countryCode: countryCode,
            addressLine1: address
          },
          contactInformation: {
            fullName: recipientName,
            phone: properties.phone || "+123456789",
            email: properties.email || "cliente@email.com"
          }
        }
      },
      content: {
        packages: [{
          weight: weight,
          dimensions: { length: 15, width: 15, height: 15 }
        }],
        isCustomsDeclarable: false,
        description: "Productos pedido HubSpot"
      }
    };

    // 3. Llamada POST a la API de DHL (Endpoint de pruebas / test)
    const dhlResponse = await axios.post(
      'https://express.api.dhl.com/mydhlapi/test/shipments',
      dhlPayload,
      {
        auth: {
          username: DHL_API_KEY,
          password: DHL_API_SECRET
        },
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const trackingNumber = dhlResponse.data.shipmentTrackingNumber;
    console.log(`Guía DHL Sandbox creada con éxito: ${trackingNumber}`);

    // 4. Actualizar el campo en el Negocio de HubSpot mediante su API CRM v3
    await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/deals/${dealId}`,
      {
        properties: {
          // Asegúrate de cambiar esto por el nombre interno exacto de tu propiedad en HubSpot
          numero_de_guia_dhl: trackingNumber 
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({ success: true, trackingNumber: trackingNumber });

  } catch (error) {
    console.error('Error al procesar el envío:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));