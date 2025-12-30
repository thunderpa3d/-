// ========== نظام المصادقة المتقدم ==========
class AuthSystem {
    constructor() {
        this.correctPassword = "60602025";
        this.maxAttempts = 5;
        this.attempts = 0;
        this.lockDuration = 30000; // 30 ثانية
        this.isLocked = false;
        
        this.init();
    }
    
    init() {
        this.cacheElements();
        this.bindEvents();
        this.checkAuthStatus();
        this.initBackgroundEffects();
    }
    
    cacheElements() {
        this.elements = {
            authScreen: document.getElementById('auth-screen'),
            appContainer: document.getElementById('app-container'),
            passwordInput: document.getElementById('password-input'),
            authMessage: document.getElementById('auth-message'),
            authSubmit: document.getElementById('auth-submit'),
            authReset: document.getElementById('auth-reset'),
            passwordToggle: document.querySelector('.password-toggle'),
            logoutBtn: document.getElementById('logout-btn')
        };
    }
    
    bindEvents() {
        // زر الدخول
        this.elements.authSubmit.addEventListener('click', () => this.validatePassword());
        
        // زر إعادة التعيين
        this.elements.authReset.addEventListener('click', () => this.resetAuth());
        
        // زر إظهار/إخفاء كلمة المرور
        this.elements.passwordToggle.addEventListener('click', () => this.togglePasswordVisibility());
        
        // زر تسجيل الخروج
        if (this.elements.logoutBtn) {
            this.elements.logoutBtn.addEventListener('click', () => this.logout());
        }
        
        // الضغط على Enter
        this.elements.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isLocked) {
                this.validatePassword();
            }
        });
        
        // تحليل قوة كلمة المرور أثناء الكتابة
        this.elements.passwordInput.addEventListener('input', (e) => {
            this.analyzePasswordStrength(e.target.value);
        });
    }
    
    checkAuthStatus() {
        const authData = this.getAuthData();
        
        if (authData.authenticated && !this.isSessionExpired(authData)) {
            this.grantAccess();
        } else {
            this.showAuthScreen();
            
            // التحقق من القفل
            if (authData.lockedUntil && Date.now() < authData.lockedUntil) {
                this.lockSystem(authData.lockedUntil - Date.now());
            }
        }
    }
    
    validatePassword() {
        if (this.isLocked) {
            this.showMessage('النظام مقفل مؤقتًا. حاول مرة أخرى لاحقًا.', 'error');
            return;
        }
        
        const input = this.elements.passwordInput.value.trim();
        
        if (!input) {
            this.showMessage('يرجى إدخال كلمة المرور', 'warning');
            this.shakeInput();
            return;
        }
        
        if (input === this.correctPassword) {
            this.successfulLogin();
        } else {
            this.failedLogin();
        }
    }
    
    successfulLogin() {
        this.attempts = 0;
        
        // حفظ بيانات المصادقة
        this.saveAuthData({
            authenticated: true,
            loginTime: Date.now(),
            sessionId: this.generateSessionId()
        });
        
        // تأثيرات بصرية للنجاح
        this.showMessage('✅ تم المصادقة بنجاح! جاري الدخول...', 'success');
        this.elements.authSubmit.disabled = true;
        this.elements.authSubmit.innerHTML = '<i class="fas fa-check-circle"></i><span>تم الدخول</span>';
        
        // انتقال سلس للتطبيق
        setTimeout(() => {
            this.grantAccess();
        }, 1500);
    }
    
    failedLogin() {
        this.attempts++;
        
        const remainingAttempts = this.maxAttempts - this.attempts;
        
        if (remainingAttempts > 0) {
            this.showMessage(`❌ كلمة المرور غير صحيحة! لديك ${remainingAttempts} محاولة${remainingAttempts > 1 ? 'ات' : 'ة'}`, 'error');
            this.shakeInput();
            this.pulseError();
        } else {
            this.lockSystem(this.lockDuration);
            this.showMessage(`🔒 النظام مقفل لمدة ${this.lockDuration / 1000} ثانية`, 'error');
        }
        
        // حفظ محاولات الفشل
        this.saveAuthData({
            failedAttempts: this.attempts,
            lastAttempt: Date.now()
        });
    }
    
    lockSystem(duration) {
        this.isLocked = true;
        this.elements.authSubmit.disabled = true;
        
        const unlockTime = Date.now() + duration;
        
        // حفظ وقت القفل
        this.saveAuthData({
            lockedUntil: unlockTime
        });
        
        // عد تنازلي للقفل
        const timer = setInterval(() => {
            const remaining = Math.ceil((unlockTime - Date.now()) / 1000);
            
            if (remaining > 0) {
                this.elements.authSubmit.innerHTML = `<i class="fas fa-lock"></i><span>مقفل (${remaining}ث)</span>`;
            } else {
                clearInterval(timer);
                this.unlockSystem();
            }
        }, 1000);
    }
    
    unlockSystem() {
        this.isLocked = false;
        this.attempts = 0;
        this.elements.authSubmit.disabled = false;
        this.elements.authSubmit.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>الدخول للنظام</span>';
        this.showMessage('🔓 تم فتح النظام، يمكنك المحاولة مرة أخرى', 'info');
        
        // تحديث بيانات المصادقة
        this.saveAuthData({
            lockedUntil: null,
            failedAttempts: 0
        });
    }
    
    grantAccess() {
        // إضافة تأثيرات انتقالية
        this.elements.authScreen.style.opacity = '0';
        this.elements.authScreen.style.transform = 'scale(0.9)';
        
        setTimeout(() => {
            this.elements.authScreen.style.display = 'none';
            this.elements.appContainer.style.display = 'block';
            
            // تهيئة التطبيق
            if (typeof window.app !== 'undefined') {
                window.app.init();
            }
            
            // إظهار رسالة ترحيب
            this.showNotification('مرحبًا بك في دليل الاتصال الذكي!', 'success');
        }, 500);
    }
    
    showAuthScreen() {
        this.elements.appContainer.style.display = 'none';
        this.elements.authScreen.style.display = 'flex';
        
        // إعادة تعيين المدخلات
        setTimeout(() => {
            this.elements.authScreen.style.opacity = '1';
            this.elements.authScreen.style.transform = 'scale(1)';
            this.elements.passwordInput.value = '';
            this.elements.passwordInput.focus();
        }, 50);
    }
    
    logout() {
        // تأكيد الخروج
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
            // مسح بيانات المصادقة
            localStorage.removeItem('appAuthenticated');
            localStorage.removeItem('authData');
            
            // إعادة التوجيه لشاشة المصادقة
            this.showAuthScreen();
            
            // رسالة تأكيد
            this.showMessage('تم تسجيل الخروج بنجاح', 'info');
        }
    }
    
    resetAuth() {
        if (confirm('سيتم مسح جميع بيانات المصادقة والجهات المخزنة محليًا. هل تريد المتابعة؟')) {
            localStorage.clear();
            this.showMessage('تم إعادة تعيين النظام بنجاح', 'success');
            setTimeout(() => {
                location.reload();
            }, 1500);
        }
    }
    
    // ========== دوال المساعدة ==========
    
    togglePasswordVisibility() {
        const input = this.elements.passwordInput;
        const toggleBtn = this.elements.passwordToggle;
        
        if (input.type === 'password') {
            input.type = 'text';
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            toggleBtn.setAttribute('title', 'إخفاء كلمة المرور');
        } else {
            input.type = 'password';
            toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
            toggleBtn.setAttribute('title', 'إظهار كلمة المرور');
        }
        
        input.focus();
    }
    
    analyzePasswordStrength(password) {
        const strengthBar = document.querySelector('.strength-bar');
        const strengthText = document.querySelector('.strength-text');
        
        if (!password) {
            strengthBar.style.width = '0%';
            strengthText.textContent = 'قوة كلمة المرور: --';
            return;
        }
        
        let strength = 0;
        let feedback = '';
        
        if (password.length >= 8) strength += 25;
        if (/[A-Z]/.test(password)) strength += 25;
        if (/[0-9]/.test(password)) strength += 25;
        if (/[^A-Za-z0-9]/.test(password)) strength += 25;
        
        strengthBar.style.width = `${strength}%`;
        
        // تحديد اللون والنص
        if (strength < 25) {
            strengthBar.style.backgroundColor = '#ff4757';
            feedback = 'ضعيفة جدًا';
        } else if (strength < 50) {
            strengthBar.style.backgroundColor = '#ffa502';
            feedback = 'ضعيفة';
        } else if (strength < 75) {
            strengthBar.style.backgroundColor = '#2ed573';
            feedback = 'جيدة';
        } else {
            strengthBar.style.backgroundColor = '#1e90ff';
            feedback = 'قوية جدًا';
        }
        
        strengthText.textContent = `قوة كلمة المرور: ${feedback}`;
    }
    
    shakeInput() {
        const input = this.elements.passwordInput;
        input.style.animation = 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both';
        
        setTimeout(() => {
            input.style.animation = '';
            input.value = '';
            input.focus();
        }, 500);
    }
    
    pulseError() {
        const messageEl = this.elements.authMessage;
        messageEl.style.animation = 'pulse 0.5s';
        
        setTimeout(() => {
            messageEl.style.animation = '';
        }, 500);
    }
    
    showMessage(text, type = 'info') {
        const messageEl = this.elements.authMessage;
        
        messageEl.textContent = text;
        messageEl.className = `auth-message auth-message-${type}`;
        messageEl.style.display = 'block';
        
        // إخفاء الرسالة بعد 5 ثواني
        if (type !== 'error') {
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 5000);
        }
    }
    
    showNotification(text, type = 'info') {
        // سيتم دمجها مع نظام الإشعارات الرئيسي
        console.log(`[${type.toUpperCase()}] ${text}`);
    }
    
    saveAuthData(data) {
        const existingData = this.getAuthData();
        const newData = { ...existingData, ...data };
        localStorage.setItem('authData', JSON.stringify(newData));
    }
    
    getAuthData() {
        const data = localStorage.getItem('authData');
        return data ? JSON.parse(data) : {};
    }
    
    isSessionExpired(authData) {
        if (!authData.loginTime) return true;
        
        const sessionDuration = 8 * 60 * 60 * 1000; // 8 ساعات
        return Date.now() - authData.loginTime > sessionDuration;
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    initBackgroundEffects() {
        const container = document.querySelector('.particles-container');
        
        if (!container) return;
        
        // إنشاء جسيمات متحركة
        for (let i = 0; i < 15; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.cssText = `
                position: absolute;
                width: ${Math.random() * 10 + 2}px;
                height: ${Math.random() * 10 + 2}px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation: float ${Math.random() * 20 + 10}s linear infinite;
                animation-delay: ${Math.random() * 5}s;
            `;
            container.appendChild(particle);
        }
    }
}

// تصدير النظام ككائن عام
window.AuthSystem = AuthSystem;