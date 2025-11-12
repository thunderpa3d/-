// ========== نظام قفل كلمة المرور ==========
const correctPassword = "60602025";

// التحقق من حالة المصادقة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking authentication...');
    const isAuthenticated = localStorage.getItem('appAuthenticated');
    
    if (isAuthenticated === 'true') {
        console.log('User authenticated, hiding password screen');
        document.getElementById('password-screen').style.display = 'none';
        document.querySelector('.app-container').style.display = 'block';
        initializeAppAfterAuth();
    } else {
        console.log('User not authenticated, showing password screen');
        document.getElementById('password-screen').style.display = 'flex';
        document.querySelector('.app-container').style.display = 'none';
    }
});

function checkPassword() {
    const input = document.getElementById('password-input').value;
    const errorElement = document.getElementById('error-message');
    
    console.log('Password check triggered, input:', input);
    
    if (input === correctPassword) {
        console.log('Password correct, authenticating user');
        localStorage.setItem('appAuthenticated', 'true');
        document.getElementById('password-screen').style.display = 'none';
        document.querySelector('.app-container').style.display = 'block';
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

function resetPassword() {
    console.log('Resetting password authentication');
    localStorage.removeItem('appAuthenticated');
    document.getElementById('password-screen').style.display = 'flex';
    document.querySelector('.app-container').style.display = 'none';
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

// ========== تطبيق دليل الاتصال الذكي - الإصدار المحسن ==========
class SmartContactApp {
    constructor() {
        this.contacts = [];
        this.filteredContacts = [];
        this.config = {
            // روابط متعددة مع CORS proxies
            dataSources: [
                {
                    url: 'https://raw.githubusercontent.com/thunderpa3d/-/main/CONTACTS.xlsx',
                    proxy: true
                },
                {
                    url: 'https://raw.githubusercontent.com/thunderpa3d/-/main/contacts.xlsx',
                    proxy: true
                },
                {
                    url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://raw.githubusercontent.com/thunderpa3d/-/main/CONTACTS.xlsx'),
                    proxy: false
                }
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

    // ========== دوال المساعدة ==========
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    escapeHtml(text) {
        if (text === null || text === undefined) {
            return '';
        }
        
        const textString = String(text);
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        };
        
        return textString.replace(/[&<>"'`=\/]/g, (char) => escapeMap[char]);
    }

    escapeHtmlAttribute(unsafeText) {
        const escaped = this.escapeHtml(unsafeText);
        return escaped.replace(/ /g, '&#32;');
    }

    // ========== دوال التهيئة ==========
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

    // ========== دوال التنقل والواجهة ==========
    initScrollHeader() {
        this.lastScrollY = window.scrollY;
        this.headerHeight = this.elements.appHeader.offsetHeight;
        
        window.addEventListener('scroll', 
            this.throttle(() => this.handleScroll(), 100)
        );
    }

    handleScroll() {
        const currentScrollY = window.scrollY;
        const scrollDelta = currentScrollY - this.lastScrollY;

        if (currentScrollY <= 0) {
            this.elements.appHeader.style.transform = 'translateY(0)';
        } else if (scrollDelta > 5 && currentScrollY > this.headerHeight) {
            this.elements.appHeader.style.transform = 'translateY(-100%)';
        } else if (scrollDelta < -5) {
            this.elements.appHeader.style.transform = 'translateY(0)';
        }

        this.lastScrollY = currentScrollY;
    }

    handleDynamicActions(event) {
        const target = event.target;
        
        if (target.closest('.copy-btn-small')) {
            const button = target.closest('.copy-btn-small');
            const value = button.getAttribute('data-copy-value');
            const label = button.getAttribute('data-copy-label');
            if (value) {
                this.copyToClipboard(value, label);
            }
            return;
        }
        
        if (target.closest('.action-btn-horizontal:not(.disabled)')) {
            const button = target.closest('.action-btn-horizontal');
            const type = button.getAttribute('data-action-type');
            const value = button.getAttribute('data-action-value');
            
            if (type && value) {
                this.handleAction(type, value);
            }
            return;
        }
    }

    // ========== دوال إدارة البيانات ==========
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
                // تحميل بيانات تجريبية إذا لم توجد بيانات محلية
                this.loadSampleData();
            }
        } catch (error) {
            console.error('Load contacts error:', error);
            this.loadSampleData();
        }
    }

    // ========== دوال المزامنة ==========
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
                console.log(`Trying data source: ${dataSource.url}, with proxy: ${dataSource.proxy}`);
                
                try {
                    success = await this.fetchAndProcessData(dataSource);
                    if (success) break;
                } catch (error) {
                    lastError = error;
                    console.error(`Failed with data source ${dataSource.url}:`, error);
                    
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
            
            if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
                errorMessage = 'مشكلة في الاتصال بالخادم - استخدام البيانات المحلية';
            } else if (error.message.includes('404')) {
                errorMessage = 'ملف البيانات غير موجود على الخادم';
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

    async fetchAndProcessData(dataSource) {
        let url = dataSource.url;
        
        // استخدام CORS proxy إذا كان مطلوبًا
        if (dataSource.proxy) {
            url = await this.getCorsProxyUrl(url);
        }

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
            raw: false
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

    // دالة للحصول على CORS proxy URL
    async getCorsProxyUrl(originalUrl) {
        // قائمة بـ CORS proxies مجانية
        const proxies = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`,
            `https://corsproxy.io/?${encodeURIComponent(originalUrl)}`,
            `https://cors-anywhere.herokuapp.com/${originalUrl}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(originalUrl)}`
        ];

        // إرجاع أول proxy (يمكن تطوير هذا لاختبار كل proxy)
        return proxies[0];
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
                    mode: 'cors'
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
        
        let cleaned = phone.toString().replace(/[^\d+]/g, '');
        
        if (cleaned.startsWith('00')) {
            cleaned = '+' + cleaned.substring(2);
        }
        
        if (cleaned.startsWith('0') && !cleaned.startsWith('+')) {
            cleaned = '+963' + cleaned.substring(1);
        }
        
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

    // ========== دوال العرض والواجهة ==========
    searchContacts() {
        const searchTerm = this.elements.searchInput.value.trim();
        
        if (!searchTerm) {
            this.filteredContacts = [...this.contacts];
        } else {
            const normalizedSearch = this.normalizeText(searchTerm);
            
            this.filteredContacts = this.contacts.filter(contact => {
                const searchFields = [
                    contact.name,
                    contact.lastName,
                    contact.phone,
                    contact.whatsapp,
                    contact.telegram,
                ].filter(Boolean);

                return searchFields.some(field => 
                    this.normalizeText(field).includes(normalizedSearch)
                );
            });
        }
        
        this.renderContacts();
    }

    renderContacts() {
        const container = this.elements.contactsContainer;
        
        if (!container) {
            console.error('Contacts container not found');
            return;
        }

        if (this.filteredContacts.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
        } else {
            container.innerHTML = this.filteredContacts
                .map(contact => this.getContactCardHTML(contact))
                .join('');
        }
        
        this.updateContactsCount();
    }

    getContactCardHTML(contact) {
        const firstLetter = (contact.name || contact.lastName || '?').charAt(0).toUpperCase();
        const displayName = `${contact.name || ''} ${contact.lastName || ''}`.trim() || 'بدون اسم';
        const contactId = this.escapeHtmlAttribute(contact.id);
        
        return `
        <div class="contact-card" data-contact-id="${contactId}">
            <div class="contact-avatar" aria-label="صورة ${this.escapeHtml(displayName)}">
                ${firstLetter}
            </div>
            
            <div class="contact-info-horizontal">
                <h3 class="contact-name">${this.escapeHtml(displayName)}</h3>
                <div class="contact-details-grid">
                    ${this.getContactFieldHTML('fas fa-phone', contact.phone, 'رقم الهاتف')}
                    ${this.getContactFieldHTML('fab fa-whatsapp', contact.whatsapp, 'رقم الواتساب')}
                    ${this.getContactFieldHTML('fab fa-telegram', contact.telegram, 'حساب التليجرام', '@' + contact.telegram)}
                </div>
            </div>
            
            <div class="contact-actions-horizontal">
                ${this.getActionButtonHTML('call', 'اتصال', 'fas fa-phone', contact.phone)}
                ${this.getActionButtonHTML('whatsapp', 'واتساب', 'fab fa-whatsapp', contact.whatsapp)}
                ${this.getActionButtonHTML('telegram', 'تيليجرام', 'fab fa-telegram', contact.telegram)}
            </div>
        </div>
        `;
    }

    getContactFieldHTML(icon, value, label, displayValue = null) {
        if (!value) return '';
        
        const safeValue = this.escapeHtmlAttribute(value);
        const safeLabel = this.escapeHtmlAttribute(label);
        const display = this.escapeHtml(displayValue || value);
        
        return `
        <div class="contact-field-horizontal">
            <i class="${icon}" aria-hidden="true"></i>
            <div class="contact-field-content">
                <span>${display}</span>
                <button class="copy-btn-small" 
                        data-copy-value="${safeValue}"
                        data-copy-label="${safeLabel}"
                        aria-label="نسخ ${safeLabel}">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        </div>
        `;
    }

    getActionButtonHTML(type, text, icon, value) {
        const isDisabled = !value;
        const safeValue = value ? this.escapeHtmlAttribute(value) : '';
        const safeType = this.escapeHtmlAttribute(type);
        const ariaLabel = this.escapeHtmlAttribute(
            isDisabled ? `${text} غير متاح` : `${this.getActionLabel(type, value)}`
        );
        
        return `
        <button class="action-btn-horizontal ${safeType} ${isDisabled ? 'disabled' : ''}" 
                ${isDisabled ? 'disabled' : ''}
                data-action-type="${safeType}"
                data-action-value="${safeValue}"
                aria-label="${ariaLabel}">
            <i class="${icon}"></i>
        </button>
        `;
    }

    getActionLabel(type, value) {
        switch (type) {
            case 'call': return `اتصال بالرقم ${value}`;
            case 'whatsapp': return `فتح واتساب للرقم ${value}`;
            case 'telegram': return `فتح تيليجرام للحساب ${value}`;
            default: return '';
        }
    }

    getEmptyStateHTML() {
        const hasSearch = this.elements.searchInput.value.trim();
        
        return `
        <div class="empty-state">
            <i class="fas fa-${hasSearch ? 'search' : 'users'}" 
               aria-hidden="true"></i>
            <h3>${hasSearch ? 'لا توجد نتائج' : 'لا توجد جهات اتصال'}</h3>
            <p>${hasSearch ? 'جرب مصطلحات بحث مختلفة' : 'قم بالمزامنة لتحميل جهات الاتصال'}</p>
            ${!hasSearch ? `<button class="sync-btn-large" onclick="app.syncWithGitHub(true)">
                <i class="fas fa-sync"></i> مزامنة الآن
            </button>` : ''}
        </div>
        `;
    }

    // ========== دوال الإجراءات ==========
    handleAction(type, value) {
        if (!value) return;

        try {
            switch (type) {
                case 'call':
                    this.callNumber(value);
                    break;
                case 'whatsapp':
                    this.openWhatsApp(value);
                    break;
                case 'telegram':
                    this.openTelegram(value);
                    break;
            }
            
            this.logAction(type, value);
        } catch (error) {
            console.error('Action error:', error);
            this.showNotification('فشل تنفيذ الإجراء', 'error');
        }
    }

    callNumber(phone) {
        try {
            const telLink = `tel:${phone}`;
            const link = document.createElement('a');
            link.href = telLink;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification(`جاري الاتصال بالرقم ${phone}`, 'info', 2000);
        } catch (error) {
            console.error('Call error:', error);
            this.showNotification('تعذر إجراء المكالمة', 'error');
        }
    }

    openWhatsApp(whatsapp) {
        try {
            const cleanNumber = whatsapp.replace(/[^\d+]/g, '');
            
            if (!cleanNumber || cleanNumber.length < 10) {
                this.showNotification('رقم واتساب غير صالح', 'error');
                return;
            }
            
            const whatsappUrl = `https://wa.me/${cleanNumber}`;
            const newWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
            
            if (newWindow) {
                newWindow.opener = null;
            } else {
                this.showNotification('الرجاء السماح بالنوافذ المنبثقة لفتح واتساب', 'info');
                window.location.href = whatsappUrl;
            }
            
            this.showNotification(`جاري فتح واتساب للرقم ${cleanNumber}`, 'info', 2000);
        } catch (error) {
            console.error('WhatsApp open error:', error);
            this.showNotification('تعذر فتح واتساب', 'error');
        }
    }

    openTelegram(telegram) {
        try {
            const cleanUsername = telegram.replace(/^@+/, '');
            const telegramUrl = `https://web.telegram.org/k/#@${cleanUsername}`;
            const newWindow = window.open(telegramUrl, '_blank', 'noopener,noreferrer');
            
            if (newWindow) {
                newWindow.opener = null;
            } else {
                this.showNotification('الرجاء السماح بالنوافذ المنبثقة لفتح Telegram', 'info');
                window.location.href = telegramUrl;
            }
            
            this.showNotification(`جاري فتح تيليجرام للحساب @${cleanUsername}`, 'info', 2000);
        } catch (error) {
            console.error('Telegram open error:', error);
            this.showNotification('تعذر فتح تيليجرام', 'error');
        }
    }

    async copyToClipboard(text, label) {
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            this.showNotification(`تم نسخ ${label}`, 'success', 2000);
        } catch (error) {
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                if (successful) {
                    this.showNotification(`تم نسخ ${label}`, 'success', 2000);
                } else {
                    throw new Error('Copy command failed');
                }
            } catch (fallbackError) {
                console.error('Copy fallback error:', fallbackError);
                this.showNotification('فشل نسخ النص', 'error');
            }
        }
    }

    // ========== دوال المساعدة العامة ==========
    updateContactsCount() {
        if (this.elements.contactsCount) {
            const total = this.contacts.length;
            const filtered = this.filteredContacts.length;
            const countText = total === filtered ? 
                `${total} جهة اتصال` : 
                `${filtered} من ${total} جهة اتصال`;
            
            this.elements.contactsCount.textContent = countText;
        }
    }

    showNotification(message, type = 'info', duration = 5000) {
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
        
        setTimeout(() => notification.classList.add('show'), 10);
        
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        });
        
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

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    showLoading() {
        this.elements.loadingOverlay.classList.add('show');
        this.elements.loadingOverlay.setAttribute('aria-hidden', 'false');
    }

    hideLoading() {
        this.elements.loadingOverlay.classList.remove('show');
        this.elements.loadingOverlay.setAttribute('aria-hidden', 'true');
    }

    startAutoSync() {
        setInterval(() => {
            if (navigator.onLine && !this.isLoading) {
                this.syncWithGitHub();
            }
        }, this.config.syncInterval);
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('smartContactApp', JSON.stringify(this.contacts));
            localStorage.setItem('smartContactApp_timestamp', Date.now().toString());
        } catch (error) {
            console.error('Save to localStorage error:', error);
            this.showNotification('فشل حفظ البيانات محلياً', 'warning');
        }
    }

    loadSampleData() {
        const sampleContacts = [
            {
                id: 'sample-1',
                name: 'عمار قصاب',
                lastName: 'أبو رعد الحموي',
                phone: '+963934096914',
                whatsapp: '+963934096914',
                telegram: 'TF3RAAD'
            },
            {
                id: 'sample-2', 
                name: 'محمد أحمد',
                phone: '+963123456789',
                whatsapp: '+963123456789',
                telegram: 'mohammed_ahmed'
            }
        ];
        
        this.contacts = sampleContacts;
        this.filteredContacts = [...this.contacts];
        this.saveToLocalStorage();
        this.renderContacts();
        this.showNotification('تم تحميل البيانات التجريبية', 'info');
    }

    logAction(type, value) {
        console.log(`User action: ${type} - ${value}`);
    }

    destroy() {
        window.removeEventListener('online', this.onlineHandler);
        window.removeEventListener('offline', this.offlineHandler);
        this.isLoading = false;
    }
}

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
