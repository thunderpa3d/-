// ========== نظام قفل كلمة المرور ==========
const correctPassword = "60602025";

// التحقق من حالة المصادقة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking authentication...');
    const isAuthenticated = localStorage.getItem('appAuthenticated');
    
    if (isAuthenticated === 'true') {
        console.log('User authenticated, hiding password screen');
        hidePasswordScreen();
        initializeAppAfterAuth();
    } else {
        console.log('User not authenticated, showing password screen');
        document.getElementById('password-screen').style.display = 'flex';
        document.querySelector('.app-container').style.display = 'none';
        document.querySelector('.dynamic-background').style.display = 'none';
        document.querySelector('.animated-particles').style.display = 'none';
    }
});

function checkPassword() {
    const input = document.getElementById('password-input').value;
    const errorElement = document.getElementById('error-message');
    
    console.log('Password check triggered, input:', input);
    
    if (input === correctPassword) {
        console.log('Password correct, authenticating user');
        localStorage.setItem('appAuthenticated', 'true');
        hidePasswordScreen();
        initializeAppAfterAuth();
    } else {
        console.log('Password incorrect');
        errorElement.textContent = 'كلمة المرور غير صحيحة!';
        document.getElementById('password-input').value = '';
        document.getElementById('password-input').style.animation = 'shake 0.5s';
        setTimeout(() => {
            document.getElementById('password-input').style.animation = '';
        }, 500);
    }
}

function hidePasswordScreen() {
    console.log('Hiding password screen');
    const passwordScreen = document.getElementById('password-screen');
    passwordScreen.style.opacity = '0';
    
    setTimeout(() => {
        passwordScreen.style.display = 'none';
        document.querySelector('.app-container').style.display = 'block';
        document.querySelector('.dynamic-background').style.display = 'block';
        document.querySelector('.animated-particles').style.display = 'block';
    }, 500);
}

function resetPassword() {
    console.log('Resetting password authentication');
    localStorage.removeItem('appAuthenticated');
    document.getElementById('password-screen').style.display = 'flex';
    document.querySelector('.app-container').style.display = 'none';
    document.querySelector('.dynamic-background').style.display = 'none';
    document.querySelector('.animated-particles').style.display = 'none';
    document.getElementById('password-screen').style.opacity = '1';
    document.getElementById('password-input').value = '';
    document.getElementById('error-message').textContent = '';
}

// السماح باستخدام زر Enter لإدخال كلمة المرور
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('password-input');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                checkPassword();
            }
        });
    }
});

// ========== تهيئة التطبيق بعد المصادقة ==========
function initializeAppAfterAuth() {
    console.log('Initializing application after authentication');
    try {
        window.app = new SmartContactApp();
        
        window.addEventListener('beforeunload', () => {
            if (window.app && typeof window.app.destroy === 'function') {
                window.app.destroy();
            }
        });
    } catch (error) {
        console.error('Failed to initialize app:', error);
        document.body.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #ef4444;">
                <h2>خطأ في تحميل التطبيق</h2>
                <p>حدث خطأ غير متوقع. يرجى تحديث الصفحة.</p>
                <button onclick="window.location.reload()" style="padding: 0.5rem 1rem; margin-top: 1rem;">
                    تحديث الصفحة
                </button>
            </div>
        `;
    }
}

// ========== تطبيق دليل الاتصال الذكي - الإصدار المحسن ==========
class SmartContactApp {
    constructor() {
        this.contacts = [];
        this.filteredContacts = [];
        this.config = {
            // روابط متعددة للنسخ الاحتياطي
            dataSources: [
                'https://raw.githubusercontent.com/thunderpa3d/-/main/CONTACTS.xlsx',
                'https://raw.githubusercontent.com/thunderpa3d/-/main/contacts.xlsx',
                'https://raw.githubusercontent.com/thunderpa3d/-/main/data.xlsx'
            ],
            syncInterval: 300000, // 5 دقائق
            maxRetries: 3,
            retryDelay: 2000,
            cacheTimeout: 300000 // 5 دقائق للكاش
        };
        
        this.isLoading = false;
        this.retryCount = 0;
        this.currentDataSourceIndex = 0;
        
        this.init();
    }

    init() {
        console.log('Initializing SmartContactApp');
        this.cacheElements();
        this.bindEvents();
        this.initScrollHeader();
        this.loadApp();
        this.startAutoSync();
    }

    cacheElements() {
        const elements = {
            contactsContainer: document.getElementById('contactsContainer'),
            searchInput: document.getElementById('searchInput'),
            notificationCenter: document.getElementById('notificationCenter'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            manualSync: document.getElementById('manualSync'),
            contactsCount: document.getElementById('contactsCount'),
            searchClear: document.querySelector('.header-search-clear'),
            appHeader: document.querySelector('.app-header')
        };

        for (const [key, element] of Object.entries(elements)) {
            if (!element) {
                console.warn(`Element not found: ${key}`);
            }
        }

        this.elements = elements;
    }

    bindEvents() {
        // البحث مع Debounce
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', 
                this.debounce(() => this.searchContacts(), 300)
            );
        }

        if (this.elements.searchClear) {
            this.elements.searchClear.addEventListener('click', () => {
                this.elements.searchInput.value = '';
                this.searchContacts();
                this.elements.searchInput.focus();
            });
        }

        // المزامنة اليدوية
        if (this.elements.manualSync) {
            this.elements.manualSync.addEventListener('click', 
                () => this.syncWithGitHub(true)
            );
        }

        // اكتشاف حالة الاتصال
        window.addEventListener('online', () => {
            this.showNotification('متصل بالإنترنت - جاري المزامنة...', 'info');
            setTimeout(() => this.syncWithGitHub(), 1000);
        });

        window.addEventListener('offline', () => {
            this.showNotification('غير متصل بالإنترنت', 'warning');
        });

        if (this.elements.notificationCenter) {
            this.elements.notificationCenter.addEventListener('click', (e) => {
                if (e.target.closest('.notification')) {
                    e.target.closest('.notification').remove();
                }
            });
        }

        if (this.elements.contactsContainer) {
            this.elements.contactsContainer.addEventListener('click', (e) => {
                this.handleDynamicActions(e);
            });
        }
    }

    // ... (بقية الدوال مثل handleDynamicActions, initScrollHeader, handleScroll تبقى كما هي)

    async loadApp() {
        if (this.isLoading) return;
        
        this.showLoading();
        
        try {
            await this.loadContacts();
            this.renderContacts();
            
            if (navigator.onLine) {
                setTimeout(() => this.syncWithGitHub(), 1000);
            } else {
                this.showNotification('التطبيق يعمل في الوضع غير المتصل', 'info');
            }
        } catch (error) {
            console.error('App load error:', error);
            this.showNotification('خطأ في تحميل التطبيق', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadContacts() {
        try {
            const savedContacts = localStorage.getItem('smartContactApp');
            const timestamp = localStorage.getItem('smartContactApp_timestamp');
            
            if (savedContacts) {
                this.contacts = JSON.parse(savedContacts);
                this.filteredContacts = [...this.contacts];
                this.updateContactsCount();
                
                const age = timestamp ? Date.now() - parseInt(timestamp) : Infinity;
                if (age > this.config.cacheTimeout && navigator.onLine) {
                    this.showNotification('جاري تحديث البيانات...', 'info');
                } else if (this.contacts.length > 0) {
                    this.showNotification(`تم تحميل ${this.contacts.length} جهة اتصال من الذاكرة المحلية`, 'success');
                }
            } else {
                this.showNotification('لا توجد بيانات محلية، جاري التحميل...', 'info');
            }
        } catch (error) {
            console.error('Load contacts error:', error);
            throw new Error('فشل تحميل البيانات المحلية');
        }
    }

    async syncWithGitHub(force = false) {
        if (!navigator.onLine) {
            this.showNotification('غير متصل بالإنترنت', 'warning');
            return false;
        }

        if (this.isLoading && !force) {
            this.showNotification('جاري المزامنة بالفعل...', 'info');
            return false;
        }

        this.isLoading = true;
        this.showLoading();
        this.showNotification('جاري المزامنة مع مركز البيانات...', 'info');

        try {
            let success = false;
            let lastError = null;

            // تجربة جميع مصادر البيانات
            for (let i = 0; i < this.config.dataSources.length; i++) {
                const dataSource = this.config.dataSources[this.currentDataSourceIndex];
                console.log(`Trying data source: ${dataSource}`);
                
                try {
                    success = await this.fetchAndProcessData(dataSource);
                    if (success) break;
                } catch (error) {
                    lastError = error;
                    console.error(`Failed with data source ${dataSource}:`, error);
                    
                    // الانتقال إلى المصدر التالي
                    this.currentDataSourceIndex = (this.currentDataSourceIndex + 1) % this.config.dataSources.length;
                    
                    if (i < this.config.dataSources.length - 1) {
                        this.showNotification(`جرب مصدر بيانات بديل... (${i + 1}/${this.config.dataSources.length})`, 'warning');
                        await this.delay(1000);
                    }
                }
            }

            if (!success) {
                throw lastError || new Error('فشل جميع مصادر البيانات');
            }

            this.retryCount = 0;
            return true;

        } catch (error) {
            console.error('Sync error:', error);
            
            this.retryCount++;
            let errorMessage = 'فشل المزامنة - استخدام البيانات المحلية';
            
            if (error.message.includes('CORS')) {
                errorMessage = 'مشكلة في صلاحيات الوصول للبيانات';
            } else if (error.message.includes('404')) {
                errorMessage = 'ملف البيانات غير موجود';
            } else if (error.message.includes('network')) {
                errorMessage = 'مشكلة في الاتصال بالإنترنت';
            }
            
            this.showNotification(errorMessage, 'error');
            
            if (this.retryCount <= this.config.maxRetries) {
                this.showNotification(`محاولة أخرى (${this.retryCount}/${this.config.maxRetries})`, 'warning');
                setTimeout(() => this.syncWithGitHub(), this.config.retryDelay);
            }
            return false;
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    async fetchAndProcessData(url) {
        const response = await this.fetchWithTimeout(url, {
            timeout: 15000,
            retries: 2
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        
        if (arrayBuffer.byteLength === 0) {
            throw new Error('الملف المستلم فارغ');
        }

        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('ملف Excel لا يحتوي على أوراق');
        }

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            defval: '',
            raw: false // تحويل جميع القيم إلى نصوص
        });
        
        if (!jsonData || jsonData.length === 0) {
            throw new Error('الملف لا يحتوي على بيانات صالحة');
        }
        
        console.log('Raw Excel data:', jsonData);
        
        const processedData = this.processExcelData(jsonData);
        
        if (processedData.length === 0) {
            throw new Error('لا توجد جهات اتصال صالحة بعد المعالجة');
        }

        this.contacts = processedData;
        this.saveToLocalStorage();
        this.filteredContacts = [...this.contacts];
        this.renderContacts();
        
        this.showNotification(`تم تحديث ${this.contacts.length} جهة اتصال`, 'success');
        return true;
    }

    async fetchWithTimeout(url, options = {}) {
        const { timeout = 15000, retries = 2 } = options;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    controller.abort();
                    throw new Error('مهلة الاتصال انتهت');
                }, timeout);

                console.log(`Fetch attempt ${attempt} for: ${url}`);
                
                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, */*'
                    },
                    mode: 'cors',
                    credentials: 'omit'
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                return response;
            } catch (error) {
                console.error(`Fetch attempt ${attempt} failed:`, error);
                if (attempt === retries) {
                    if (error.name === 'AbortError') {
                        throw new Error('مهلة الاتصال انتهت');
                    }
                    throw error;
                }
                await this.delay(this.config.retryDelay);
            }
        }
    }

    processExcelData(jsonData) {
        console.log('Processing Excel data, rows:', jsonData.length);
        
        const columnMappings = {
            name: ['الاسم', 'name', 'اسم', 'اسم الجهة', 'جهة الاتصال', 'Contact Name', 'Name'],
            lastName: ['اللقب', 'lastname', 'last name', 'لقب', 'الكنية', 'Last Name', 'LastName'],
            phone: ['رقم الهاتف', 'phone', 'هاتف', 'تلفون', 'جوال', 'Phone', 'Mobile', 'الهاتف'],
            whatsapp: ['واتساب', 'whatsapp', 'رقم الواتساب', 'WhatsApp', 'whats app'],
            telegram: ['تليجرام', 'telegram', 'تيليجرام', 'حساب التليجرام', 'Telegram', 'tele'],
        };

        const contacts = jsonData
            .map((row, index) => {
                try {
                    const findValue = (keys) => {
                        for (const key of keys) {
                            // البحث بالحساسية للنص
                            const foundKey = Object.keys(row).find(k => 
                                this.normalizeText(k) === this.normalizeText(key)
                            );
                            if (foundKey && row[foundKey] !== null && row[foundKey] !== undefined && row[foundKey] !== '') {
                                const value = String(row[foundKey]).trim();
                                if (value && value !== 'undefined' && value !== 'null') {
                                    return value;
                                }
                            }
                        }
                        return '';
                    };

                    const contact = {
                        id: `contact-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
                        name: findValue(columnMappings.name),
                        lastName: findValue(columnMappings.lastName),
                        phone: this.cleanPhoneNumber(findValue(columnMappings.phone)),
                        whatsapp: this.cleanPhoneNumber(findValue(columnMappings.whatsapp)),
                        telegram: this.cleanTelegramUsername(findValue(columnMappings.telegram)),
                    };

                    // تسجيل البيانات للمساعدة في التصحيح
                    if (contact.name || contact.phone) {
                        console.log('Processed contact:', contact);
                    }

                    return contact;
                } catch (error) {
                    console.error('Error processing row:', row, error);
                    return null;
                }
            })
            .filter(contact => 
                contact && (contact.name || contact.lastName || contact.phone || contact.whatsapp || contact.telegram)
            );

        console.log(`Successfully processed ${contacts.length} contacts from ${jsonData.length} rows`);
        return contacts;
    }

    normalizeText(text) {
        if (!text) return '';
        return text.toString()
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[َُِّ٠-٩]/g, '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    cleanPhoneNumber(phone) {
        if (!phone) return '';
        
        // تنظيف الرقم من جميع الرموز غير الرقمية باستثناء +
        let cleaned = phone.toString().replace(/[^\d+]/g, '');
        
        // إذا كان الرقم يبدأ بـ 00 نستبدلها بـ +
        if (cleaned.startsWith('00')) {
            cleaned = '+' + cleaned.substring(2);
        }
        
        // إذا كان الرقم يبدأ بـ 0 بدون رمز دولة، نضيف رمز سوريا
        if (cleaned.startsWith('0') && !cleaned.startsWith('+')) {
            cleaned = '+963' + cleaned.substring(1);
        }
        
        // التحقق من صحة الرقم
        const phoneRegex = /^[\+]?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(cleaned) || cleaned.length < 10) {
            console.warn('Invalid phone number format:', phone, 'cleaned:', cleaned);
            return '';
        }
        
        return cleaned;
    }

    cleanTelegramUsername(username) {
        if (!username) return '';
        
        let cleaned = username.toString()
            .replace(/^@+/, '')
            .replace(/[^a-zA-Z0-9_]/g, '')
            .trim();
        
        if (cleaned.length < 5 || cleaned.length > 32) {
            console.warn('Invalid Telegram username length:', username);
            return '';
        }
        
        return cleaned;
    }

    // ... (بقية الدوال تبقى كما هي مع بعض التحسينات الطفيفة)

    showNotification(message, type = 'info', duration = 5000) {
        // تنظيف مركز الإشعارات إذا كان فيه أكثر من 3 إشعارات
        const notifications = this.elements.notificationCenter.querySelectorAll('.notification');
        if (notifications.length > 3) {
            notifications[0].remove();
        }

        const safeMessage = this.escapeHtml(message);
        const safeType = this.escapeHtmlAttribute(type);
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${safeType}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');
        
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(safeType)}"></i>
            <div class="notification-content">${safeMessage}</div>
            <button class="notification-close" aria-label="إغلاق">
                <i class="fas fa-times"></i>
            </button>
        `;

        this.elements.notificationCenter.appendChild(notification);
        
        // إظهار الإشعار بسلاسة
        setTimeout(() => notification.classList.add('show'), 10);
        
        // إضافة حدث الإغلاق
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        });
        
        // الإزالة التلقائية بعد المدة المحددة
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.classList.remove('show');
                    setTimeout(() => {
                        if (notification.parentElement) {
                            notification.remove();
                        }
                    }, 300);
                }
            }, duration);
        }
    }

    // ... (بقية الدوال utility methods تبقى كما هي)
}

// إضافة بيانات تجريبية للاختبار إذا فشلت المزامنة
function addSampleData() {
    const sampleContacts = [
        {
            id: 'sample-1',
            name: 'محمد أحمد',
            phone: '+963123456789',
            whatsapp: '+963123456789',
            telegram: 'mohammed_ahmed'
        },
        {
            id: 'sample-2', 
            name: 'فاطمة علي',
            phone: '+963987654321',
            whatsapp: '+963987654321',
            telegram: 'fatima_ali'
        }
    ];
    
    localStorage.setItem('smartContactApp', JSON.stringify(sampleContacts));
    localStorage.setItem('smartContactApp_timestamp', Date.now().toString());
    return sampleContacts;
}