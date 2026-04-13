import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  arrayUnion,
  arrayRemove,
  query,
  limit
} from 'firebase/firestore';
import {
  Heart, Clock, Search, PlusCircle, User, Share2,
  Award, Calendar, X, CheckCircle2, MessageSquare, MapPin, LogOut, Loader2,
  Send, Minus, ChevronLeft, Star, TrendingUp, Zap, Sun, Moon, AlertTriangle, Trophy, Trash2, UserMinus
} from 'lucide-react';

// --- FIREBASE YAPILANDIRMASI ---
const firebaseConfig = {
  apiKey: "AIzaSyDlcasVyzGzu_Lv2LWWqi6EbAMmOtw3qqM",
  authDomain: "bir-saat-bagis.firebaseapp.com",
  projectId: "bir-saat-bagis",
  storageBucket: "bir-saat-bagis.firebasestorage.app",
  messagingSenderId: "596539962639",
  appId: "1:596539962639:web:96df4a5b4b09e58ccf7a7a",
  measurementId: "G-TNJY7W9911"
};

// Firebase Başlatma
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "bir-saat-bagis";

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdModal, setShowAdModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  const [opportunities, setOpportunities] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Yeni İlan Formu State
  const [newAd, setNewAd] = useState({
    title: '',
    description: '',
    category: 'Eğitim',
    location: '',
    time: ''
  });

  // Sohbet State'leri
  const [activeChat, setActiveChat] = useState(null); 
  const [chatList, setChatList] = useState([]); 
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [hasNewMessageNotification, setHasNewMessageNotification] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [isChatListOpen, setIsChatListOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [pendingCancelData, setPendingCancelData] = useState(null);
  const [lastDonatedAd, setLastDonatedAd] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 1. Oturum Takibi (Authentication)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Veritabanı Dinleme (Firestore Real-time)
  useEffect(() => {
    // Kural 1: Belirtilen path yapısı kullanıldı
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'opportunities');

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOpportunities(docs);
    }, (error) => {
      console.error("Firestore Hatası:", error);
    });

    return () => unsubscribe();
  }, []);

  // 3. Mesajları Dinleme
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    const chatId = `${activeChat.opportunityId}_${activeChat.volunteerId}`;
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'messages', chatId, 'chat');
    
    // Anlık dinleme
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setMessages(msgs);
    }, (error) => console.error("Mesajlaşma Hatası:", error));

    return () => unsubscribe();
  }, [activeChat]);

  // 4. Tüm Sohbet Listesini Dinleme (Bildirimler ve Listeleme için)
  useEffect(() => {
    if (!user) return;

    // Kullanıcının katılımcı olduğu chatMeta'ları dinle
    const q = collection(db, 'artifacts', appId, 'public', 'data', 'chatMeta');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allChats = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(chat => chat.participants?.includes(user.uid))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      
      setChatList(allChats);

      // Bildirim kontrolü: Eğer aktif olmayan bir odadan yeni mesaj geldiyse
      const hasUnread = allChats.some(chat => 
        chat.lastSenderId !== user.uid && 
        (!activeChat || activeChat.opportunityId + "_" + activeChat.volunteerId !== chat.id)
      );
      setHasNewMessageNotification(hasUnread);
    });

    return () => unsubscribe();
  }, [user, activeChat]);

  // Sayfa yüklendiğinde Skeleton'u biraz daha görünür kılmak için yapay gecikme (Opsiyonel)
  useEffect(() => {
    if (loading) {
       const timer = setTimeout(() => {
          // Firebase'den veri gelse bile skeleton'un tadına bakabilmek için küçük bir gecikme
       }, 1000);
       return () => clearTimeout(timer);
    }
  }, [loading]);

  // Giriş ve Kayıt İşlemleri
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (authMode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Profil bilgisini (ismini) güncelle
        await updateProfile(userCredential.user, { displayName: displayName });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setShowAuthModal(false);
      setEmail('');
      setPassword('');
      setDisplayName('');
    } catch (err) {
      alert("Hata: " + err.message);
    }
  };

  // Yeni İlan Verme
  const handleCreateAd = async (e) => {
    e.preventDefault();
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'opportunities'), {
        ...newAd,
        provider: user.displayName || user.email.split('@')[0],
        providerId: user.uid,
        providerEmail: user.email,
        status: 'active',
        createdAt: new Date().toISOString(),
        volunteers: []
      });
      setShowAdModal(false);
      setNewAd({ title: '', description: '', category: 'Eğitim', location: '', time: '' });
    } catch (err) {
      console.error("İlan eklenemedi:", err);
    }
  };

  // 1 Saat Bağışlama İşlemi
  const handleDonate = async (optId) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'opportunities', optId);
      await updateDoc(docRef, {
        volunteers: arrayUnion({ 
          uid: user.uid, 
          email: user.email,
          name: user.displayName || user.email.split('@')[0] 
        })
      });
      
      // Başarı modalını göster
      const ad = opportunities.find(o => o.id === optId);
      setLastDonatedAd(ad);
      setShowSuccessModal(true);
    } catch (err) {
      console.error("Bağış hatası:", err);
    }
  };

  const handleCancelDonation = (optId, volunteers) => {
    setPendingCancelData({ optId, volunteers });
    setShowCancelModal(true);
  };

  const confirmCancelDonation = async () => {
    if (!user || !pendingCancelData) return;

    try {
      const { optId, volunteers } = pendingCancelData;
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'opportunities', optId);
      const volunteerEntry = volunteers.find(v => typeof v === 'string' ? v === user.uid : v.uid === user.uid);
      
      if (volunteerEntry) {
        await updateDoc(docRef, {
          volunteers: arrayRemove(volunteerEntry)
        });
        if (activeChat && activeChat.opportunityId === optId) setActiveChat(null);
      }
      setShowCancelModal(false);
      setPendingCancelData(null);
    } catch (err) {
      console.error("Vazgeçme hatası:", err);
    }
  };

  // İlanı Tamamlama (Gönüllü Saatlerini Korur)
  const handleCompleteAd = async (optId) => {
    if (!window.confirm("Bu iyiliğin başarıyla tamamlandığını onaylıyor musunuz? Gönüllülerin saatleri korunacaktır.")) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'opportunities', optId);
      await updateDoc(docRef, { status: 'completed' });
      if (activeChat && activeChat.opportunityId === optId) setActiveChat(null);
    } catch (err) { console.error("Tamamlama hatası:", err); }
  };

  // İlanı Kalıcı Silme / İptal (Gönüllü Saatlerini Siler)
  const handleDeleteAd = async (optId) => {
    if (!window.confirm("Bu ilanı tamamen iptal etmek istediğinize emin misiniz? Gönüllülerin saatleri de silinecektir.")) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'opportunities', optId);
      await deleteDoc(docRef);
      if (activeChat && activeChat.opportunityId === optId) setActiveChat(null);
    } catch (err) { console.error("Silme hatası:", err); }
  };  // Belirli Bir Gönüllüyü İlandan Çıkarma (Sağlayıcı Yetkisi)
  const handleRemoveVolunteer = async (optId, volunteerUid) => {
    if (!window.confirm("Bu gönüllüyü ilandan çıkarmak istediğinize emin misiniz? Puan alamaz ve sohbet kapanır.")) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'opportunities', optId);
      await updateDoc(docRef, {
        volunteers: arrayRemove(volunteerUid)
      });
      setActiveChat(null); // Sohbeti kapat
    } catch (err) { console.error("Gönüllü çıkarma hatası:", err); }
  };
node_identifier: App.handleRemoveVolunteer

  // Mesaj Gönderme
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !user) return;

    const chatId = `${activeChat.opportunityId}_${activeChat.volunteerId}`;
    const msgData = {
      text: newMessage,
      senderId: user.uid,
      senderEmail: user.email,
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Mesajı Kaydet
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages', chatId, 'chat'), msgData);
      
      // 2. Chat Meta'yı Güncelle (Listede görünmesi için)
      const chatMetaRef = doc(db, 'artifacts', appId, 'public', 'data', 'chatMeta', chatId);
      const volunteerId = activeChat.volunteerId;
      const providerId = activeChat.providerId || user.uid;
      
      const metaData = {
        lastMessage: newMessage,
        lastSenderId: user.uid,
        updatedAt: new Date().toISOString(),
        participants: [volunteerId, providerId],
        opportunityTitle: activeChat.title,
        volunteerName: activeChat.volunteerName || (user.uid === volunteerId ? (user.displayName || user.email.split('@')[0]) : "Gönüllü"),
        providerName: activeChat.providerName || activeChat.otherPartyName || (user.uid === providerId ? (user.displayName || user.email.split('@')[0]) : "İlan Sahibi")
      };

      await updateDoc(chatMetaRef, metaData).catch(async () => {
        await setDoc(chatMetaRef, {
          id: chatId,
          opportunityId: activeChat.opportunityId,
          volunteerId: volunteerId,
          providerId: providerId,
          ...metaData
        });
      });

      setNewMessage('');
    } catch (err) {
      console.error("Mesaj gönderilemedi:", err);
    }
  };

  // Yardımcı Fonksiyon: Kullanıcının katılıp katılmadığını kontrol et
  const hasUserJoined = (volunteers, userId) => {
    if (!volunteers || !userId) return false;
    return volunteers.some(v => typeof v === 'string' ? v === userId : v.uid === userId);
  };

  // E-posta İstemcisini Tetikleyen Yardımcı Fonksiyon
  const openMailClient = (to, subject, body = "") => {
    if (!to) {
      alert("E-posta adresi bulunamadı!");
      return;
    }
    const cleanTo = to.trim();
    const mailtoUrl = `mailto:${cleanTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Güvenli açılış denemesi
    try {
      window.location.href = mailtoUrl;
    } catch (error) {
      console.error("Mail istemcisi açılamadı:", error);
      alert("E-posta uygulaması tetiklenemedi. Lütfen adresi kopyalayıp manuel gönderin.");
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-rose-500 w-12 h-12 mb-4" />
        <p className="font-bold text-slate-400 uppercase tracking-widest">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans pb-20`}>

      {/* HEADER */}
      <header className={`border-b sticky top-0 z-40 p-4 backdrop-blur-md transition-colors ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 group cursor-pointer">
              <div className="bg-rose-500 p-2 rounded-xl group-hover:rotate-12 transition-transform shadow-lg shadow-rose-500/20">
                <Heart className="text-white w-5 h-5 fill-current" />
              </div>
              <h1 className="text-xl font-black italic tracking-tighter">1SAATİNİBAĞIŞLA</h1>
            </div>
            
            <button 
              onClick={() => setShowLeaderboard(true)}
              className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] tracking-widest transition-all ${isDarkMode ? 'bg-slate-800 text-amber-400 hover:bg-amber-400/10' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
            >
              <Trophy size={14} />
              İYİLİK LİGİ
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Dark Mode Toggle */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2.5 rounded-xl transition-all ${isDarkMode ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {user ? (
              <div className="relative">
                <button 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${showProfileMenu ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : (isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}`}
                >
                  <User size={20} />
                </button>

                {/* ZENGİN PROFİL KARTI (DROPDOWN) */}
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
                    <div className={`absolute right-0 mt-4 w-72 rounded-[2.5rem] shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-200 origin-top-right border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white text-slate-900'}`}>
                      <div className="p-6 text-left">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-rose-500/20">
                            {(user.displayName || user.email)[0].toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-sm truncate max-w-[150px]">{user.displayName || user.email.split('@')[0]}</span>
                            <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Gönüllü Üye</span>
                          </div>
                        </div>

                        {(() => {
                           const donateCount = opportunities.filter(o => hasUserJoined(o.volunteers, user.uid)).length;
                           const adCount = opportunities.filter(o => o.providerId === user.uid).length;
                           const level = donateCount >= 10 ? 'Altın' : donateCount >= 5 ? 'Gümüş' : 'Bronz';
                           const levelColor = donateCount >= 10 ? 'bg-amber-400' : donateCount >= 5 ? 'bg-slate-400' : 'bg-orange-400';
                           
                           let nextTarget = 5;
                           let nextLevel = "Gümüş";
                           if (donateCount >= 5 && donateCount < 10) { nextTarget = 10; nextLevel = "Altın"; }
                           else if (donateCount >= 10) { nextTarget = 20; nextLevel = "Elit"; }
                           const remaining = nextTarget - donateCount;
                           const progress = Math.min((donateCount / nextTarget) * 100, 100);

                           return (
                             <div className="space-y-6 text-left mt-2 px-1">
                               <div className="grid grid-cols-3 gap-3">
                                  <div className={`p-4 rounded-3xl text-center group transition-all ${isDarkMode ? 'bg-slate-800/60 border border-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                                    <span className={`text-[8px] font-black block mb-2 tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>BAĞIŞ</span>
                                    <span className={`text-xl font-black italic tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'} group-hover:text-rose-500 transition-colors`}>{donateCount}s</span>
                                  </div>
                                  
                                  <div className={`p-4 rounded-3xl text-center group transition-all ${isDarkMode ? 'bg-slate-800/60 border border-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                                    <span className={`text-[8px] font-black block mb-2 tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>İLAN</span>
                                    <span className={`text-xl font-black italic tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'} group-hover:text-blue-500 transition-colors`}>{adCount}</span>
                                  </div>
                                  
                                  <div className={`p-4 rounded-3xl flex flex-col items-center justify-center transition-all ${isDarkMode ? 'bg-slate-800/60 border border-slate-800 shadow-xl shadow-rose-900/5' : 'bg-slate-50 border border-slate-100 shadow-xl shadow-rose-100/5'}`}>
                                    <span className={`text-[8px] font-black block mb-2 tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>SEVİYE</span>
                                    <div className={`px-2 py-1 rounded-lg text-[8px] font-black text-white shadow-xl shadow-current/20 ${levelColor}`}>
                                      {level.toUpperCase()}
                                    </div>
                                  </div>
                               </div>

                               <div className={`p-5 rounded-[2rem] border ${isDarkMode ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-rose-100/50 shadow-sm'}`}>
                                  <div className="flex justify-between text-[9px] font-black uppercase mb-4 px-1">
                                    <span className={isDarkMode ? 'text-slate-400' : 'text-slate-400'}>Hedef: {nextLevel}</span>
                                    <span className="text-rose-500">{remaining} SAAT KALDI</span>
                                  </div>
                                  <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                                    <div className="h-full bg-gradient-to-r from-rose-500 to-orange-400 transition-all duration-1000 shadow-[2px_0_10px_rgba(244,63,94,0.3)]" style={{ width: `${progress}%` }}></div>
                                  </div>
                               </div>
                             </div>
                           )
                        })()}

                        <button 
                          onClick={() => { signOut(auth); setShowProfileMenu(false); }}
                          className="w-full mt-8 py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl text-[10px] font-black tracking-widest hover:bg-rose-600 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200/10"
                        >
                          <LogOut size={14} /> GÜVENLİ ÇIKIŞ
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-rose-500 transition-all shadow-lg shadow-slate-200"
              >
                Giriş Yap
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ANA İÇERİK */}
      <main className="max-w-5xl mx-auto px-4 pt-12">

        {/* HERO */}
        <section className="mb-12">
          <h2 className={`text-5xl md:text-7xl font-black mb-6 leading-[1] tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Para değil, <br />
            <span className="text-rose-500 underline decoration-rose-200 decoration-8 underline-offset-8">zamanını</span> bağışla.
          </h2>
          <p className={`text-lg md:text-xl max-w-xl leading-relaxed font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Haftada sadece 1 saatinle birinin hayatında gerçek bir fark yaratabilirsin. Topluluğumuza katıl ve iyiliği yay.
          </p>
        </section>


        {/* ARAMA VE EKLEME ÇUBUĞU */}
        <div className="flex flex-col md:flex-row gap-4 mb-12">
          <div className="relative flex-1 group">
            <Search className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-slate-600 group-focus-within:text-rose-500' : 'text-slate-300 group-focus-within:text-rose-500'}`} size={20} />
            <input
              type="text"
              placeholder="Gönüllülük ilanı ara (ör: Kitap okuma, Yazılım desteği...)"
              className={`w-full pl-14 pr-6 py-5 rounded-[2rem] border-2 transition-all outline-none text-sm font-bold shadow-sm ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white focus:border-rose-500' : 'bg-white border-slate-50 focus:border-rose-500'
              }`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => user ? setShowAdModal(true) : setShowAuthModal(true)}
            className="bg-rose-500 text-white px-8 py-5 rounded-[2rem] font-black text-sm flex items-center justify-center gap-3 hover:bg-rose-600 hover:-translate-y-1 active:scale-95 transition-all shadow-xl shadow-rose-500/10"
          >
            <PlusCircle size={24} />
            YENİ İLAN VER
          </button>
        </div>

        {/* TABLAR */}
        <div className={`flex items-center border-b mb-8 overflow-x-auto whitespace-nowrap ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-8 py-4 font-black text-sm tracking-widest transition-all border-b-4 ${activeTab === 'browse' ? 'border-rose-500 text-rose-500' : `border-transparent ${isDarkMode ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}`}
          >
            İLANLARI KEŞFET
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-8 py-4 font-black text-sm tracking-widest transition-all border-b-4 ${activeTab === 'mine' ? 'border-rose-500 text-rose-500' : `border-transparent ${isDarkMode ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}`}
          >
            KATILDIKLARIM
          </button>
          <button
            onClick={() => setActiveTab('myAds')}
            className={`px-8 py-4 font-black text-sm tracking-widest transition-all border-b-4 ${activeTab === 'myAds' ? 'border-rose-500 text-rose-500' : `border-transparent ${isDarkMode ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}`}
          >
            İLANLARIM
          </button>
        </div>

        {/* İLAN KARTLARI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {loading ? (
             [1,2,3,4].map(idx => (
              <div key={idx} className={`p-8 rounded-[3rem] border border-transparent animate-pulse ${isDarkMode ? 'bg-slate-900' : 'bg-white shadow-sm border-slate-100'}`}>
                <div className="flex justify-between mb-6">
                  <div className={`w-14 h-14 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}></div>
                  <div className={`w-24 h-6 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}></div>
                </div>
                <div className={`w-3/4 h-8 rounded-xl mb-4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}></div>
                <div className={`w-full h-16 rounded-2xl mb-6 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}></div>
                <div className={`w-full h-12 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}></div>
              </div>
            ))
          ) : (() => {
            const filtered = opportunities
              .filter(o => o.status !== 'completed')
              .filter(o => {
                if (activeTab === 'browse') return true;
                if (activeTab === 'mine') return hasUserJoined(o.volunteers, user?.uid);
                if (activeTab === 'myAds') return o.providerId === user?.uid;
                return true;
              })
              .filter(opt => opt.title.toLowerCase().includes(searchQuery.toLowerCase()));

            if (filtered.length === 0) {
                return (
                  <div className={`col-span-full text-center py-24 rounded-[4rem] border-4 border-dashed ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-slate-50 text-slate-200'}`}>
                      <Search size={32} />
                    </div>
                    <h3 className={`text-xl font-black mb-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        {activeTab === 'browse' ? 'Sonuç Bulunamadı' : 
                         activeTab === 'mine' ? 'Henüz Bir İlana Katılmadınız' : 
                         'Henüz Bir İlan Vermediniz'}
                    </h3>
                    <p className="text-slate-500 font-bold text-sm">
                        {activeTab === 'browse' ? 'Farklı bir arama yapmayı dene.' : 
                         activeTab === 'mine' ? 'İlanları keşfederek iyiliğe başlayabilirsin!' : 
                         'Hemen ilk ilanını vererek birine yardımcı ol!'}
                    </p>
                  </div>
                );
            }

            return filtered.map((opt) => (
              <div key={opt.id} className={`p-8 rounded-[3rem] border transition-all group relative overflow-hidden ${
                isDarkMode ? 'bg-slate-900 border-slate-800 hover:border-rose-500/50 shadow-2xl' : 'bg-white border-slate-100 shadow-sm hover:shadow-2xl'
              }`}>
                <div className="flex justify-between items-start mb-6">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                    isDarkMode ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-rose-50 text-rose-600 border-rose-100'
                  }`}>
                    {opt.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}>@{opt.provider}</div>
                    
                    {/* YÖNETİM BUTONLARI (SADECE SAHİBİNE) */}
                    {opt.providerId === user?.uid && (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCompleteAd(opt.id); }}
                          className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white' : 'bg-green-50 text-green-600 hover:bg-green-500 hover:text-white'}`}
                          title="Tamamlandı Olarak İşaretle (Saatleri Korur)"
                        >
                          <CheckCircle2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteAd(opt.id); }}
                          className={`p-2 rounded-xl transition-all ${isDarkMode ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white'}`}
                          title="İptal Et / Kalıcı Sil (Saatleri de Siler)"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className={`text-2xl font-black mb-3 group-hover:text-rose-500 transition-colors leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{opt.title}</h3>
                <p className={`text-sm mb-8 line-clamp-2 leading-relaxed font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{opt.description}</p>

                <div className={`grid grid-cols-2 gap-4 mb-8 p-5 rounded-[2rem] ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50/50'}`}>
                  <div className={`flex items-center gap-2 text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Clock size={16} className="text-rose-400" />
                    <span>{opt.time}</span>
                  </div>
                  <div className={`flex items-center gap-2 text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <MapPin size={16} className="text-rose-400" />
                    <span>{opt.location}</span>
                  </div>
                </div>

                <div className={`flex flex-col gap-4 pt-6 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black uppercase ${isDarkMode ? 'bg-rose-500 text-white' : 'bg-slate-900 text-white'}`}>
                        {opt.provider[0]}
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-[10px] font-black uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}>Gönüllü Sayısı</span>
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{opt.volunteers?.length || 0} Kişi</span>
                      </div>
                    </div>
                    {opt.providerId !== user?.uid && (
                       <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDonate(opt.id)}
                            disabled={hasUserJoined(opt.volunteers, user?.uid)}
                            className={`px-8 py-3 rounded-2xl text-xs font-black transition-all ${hasUserJoined(opt.volunteers, user?.uid)
                                ? 'bg-green-100/20 text-green-500 cursor-default'
                                : (isDarkMode ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-slate-900 text-white hover:bg-rose-500 shadow-lg active:scale-95')
                              }`}
                          >
                            {hasUserJoined(opt.volunteers, user?.uid) ? 'KATILDIN' : '1 SAAT BAĞIŞLA'}
                          </button>
                          
                          {hasUserJoined(opt.volunteers, user?.uid) && (
                            <button
                              onClick={() => handleCancelDonation(opt.id, opt.volunteers)}
                              className={`p-3 rounded-2xl transition-all ${isDarkMode ? 'bg-slate-800 text-slate-500 hover:text-rose-500 shadow-inner' : 'bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500'}`}
                              title="Bağıştan Vazgeç"
                            >
                              <X size={16} />
                            </button>
                          )}
                       </div>
                     )}
                  </div>

                  {/* MESAJLAŞMA ALANI */}
                  {hasUserJoined(opt.volunteers, user?.uid) && opt.providerId !== user?.uid && (
                    <div className={`rounded-3xl p-6 mt-4 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-rose-50 border-rose-100/50'}`}>
                       <div className="flex items-center gap-3 mb-4">
                         <div className="w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-lg">
                           <MessageSquare size={18} />
                         </div>
                         <div>
                           <span className="text-xs font-black text-rose-300 uppercase block tracking-widest">Hemen Konuşun</span>
                           <span className="text-sm font-bold text-rose-900">İlan Sahibi {opt.provider}</span>
                         </div>
                       </div>
                       <button 
                         onClick={() => setActiveChat({
                           opportunityId: opt.id,
                           volunteerId: user.uid,
                           providerId: opt.providerId,
                           title: opt.title,
                           volunteerName: user.email.split('@')[0],
                           providerName: opt.provider,
                           otherPartyName: opt.provider
                         })}
                         className="w-full bg-white text-rose-600 py-4 rounded-2xl text-sm font-black shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 border border-rose-100"
                       >
                         MESAJLAŞMAYA BAŞLA
                       </button>
                    </div>
                  )}

                  {opt.providerId === user?.uid && opt.volunteers?.length > 0 && (
                     <div className="bg-slate-50 rounded-3xl p-6 mt-4 border border-slate-200/50">
                         <span className="text-xs font-black text-slate-400 mb-4 block uppercase tracking-widest">Başvuru Yapan Gönüllüler</span>
                         <div className="space-y-3">
                           {opt.volunteers.map((v, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm group/item hover:border-rose-200 transition-colors">
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-700">{typeof v === 'string' ? "Misafir Gönüllü" : v.email.split('@')[0]}</span>
                                  <span className="text-[10px] font-medium text-slate-400">{typeof v === 'string' ? v : v.email}</span>
                                </div>
                                {typeof v !== 'string' && (
                                  <button 
                                    onClick={() => setActiveChat({
                                      opportunityId: opt.id,
                                      volunteerId: v.uid,
                                      providerId: opt.providerId,
                                      title: opt.title,
                                      volunteerName: v.email.split('@')[0],
                                      providerName: opt.provider,
                                      otherPartyName: v.email.split('@')[0]
                                    })}
                                    className="bg-rose-50 text-rose-500 px-4 py-2 rounded-xl text-xs font-black hover:bg-rose-500 hover:text-white transition-all flex items-center gap-2"
                                  >
                                    <MessageSquare size={14} />
                                    Konuş
                                  </button>
                                )}
                              </div>
                           ))}
                         </div>
                     </div>
                  )}
                </div>
              </div>
            ));
          })()}
        </div>

      </main>

      {/* İYİLİK LİGİ MODALI */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowLeaderboard(false)}></div>
          <div className={`w-full max-w-lg rounded-[3rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-800 text-white' : 'bg-white'}`}>
            <div className={`p-8 border-b ${isDarkMode ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-amber-50/30'}`}>
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-400 text-white rounded-2xl shadow-lg shadow-amber-200">
                      <Trophy size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black italic tracking-tighter">İyilik Ligi</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">En Çok Zaman Bağışlayanlar</p>
                    </div>
                  </div>
                  <button onClick={() => setShowLeaderboard(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                    <X size={24} />
                  </button>
               </div>
            </div>

            <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
               <div className="space-y-4">
                  {(() => {
                    const scores = {};
                    opportunities.forEach(opt => {
                      opt.volunteers?.forEach(v => {
                        const uid = typeof v === 'string' ? v : v.uid;
                        const name = typeof v === 'string' ? "Gönüllü" : (v.name || v.email.split('@')[0]);
                        if (!scores[uid]) scores[uid] = { name, count: 0 };
                        scores[uid].count++;
                      });
                    });

                    const topUsers = Object.values(scores)
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 10);

                    if (topUsers.length === 0) return <div className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Henüz Kahraman Yok...</div>;

                    return topUsers.map((u, idx) => (
                      <div key={idx} className={`flex items-center justify-between p-4 rounded-3xl transition-all ${
                        isDarkMode ? 'bg-slate-800/40 hover:bg-slate-800' : 'bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-slate-100'
                      }`}>
                        <div className="flex items-center gap-4">
                           <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-inner ${
                             idx === 0 ? 'bg-gradient-to-tr from-amber-400 to-orange-500 text-white scale-110' : 
                             idx === 1 ? 'bg-slate-300 text-white' : 
                             idx === 2 ? 'bg-orange-300 text-white' : 
                             (isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-white text-slate-400')
                           }`}>
                             {idx + 1}
                           </div>
                           <div>
                              <div className="font-black text-sm">{u.name}</div>
                              {idx === 0 && <div className="text-[8px] font-black uppercase text-amber-500 tracking-tighter">HAFTANIN KAHRAMANI</div>}
                           </div>
                        </div>
                        <div className="text-right">
                           <div className="text-xl font-black text-rose-500 italic tracking-tighter">{u.count} <span className="text-[10px] not-italic text-slate-400">SAAT</span></div>
                        </div>
                      </div>
                    ));
                  })()}
               </div>
            </div>

            <div className={`p-6 border-t text-center ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-50 bg-slate-50/30'}`}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sen de bağış yap, ligde yerini al!</p>
            </div>
          </div>
        </div>
      )}

      {/* İPTAL ONAY MODALI */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowCancelModal(false)}></div>
          <div className={`w-full max-w-sm rounded-[3rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="p-10 text-center">
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg ${isDarkMode ? 'bg-rose-500/10 text-rose-500' : 'bg-rose-50 text-rose-500'}`}>
                <AlertTriangle size={36} />
              </div>
              
              <h3 className={`text-2xl font-black tracking-tighter mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Planların mı değişti?</h3>
              <p className="text-slate-500 font-bold mb-8 text-sm leading-relaxed">
                Bu bağıştan vazgeçmek istediğinden emin misin? Unutma, senin yardımın birinin hayatını kolaylaştırabilir.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-rose-500 transition-all shadow-xl shadow-slate-200/10"
                >
                  BAĞIŞI TUT, YARDIM ET
                </button>
                <button
                  onClick={confirmCancelDonation}
                  className={`w-full py-3 rounded-2xl font-black text-[10px] tracking-widest transition-all ${isDarkMode ? 'text-slate-600 hover:text-rose-500' : 'text-slate-300 hover:text-rose-500'}`}
                >
                  EVET, ŞİMDİLİK VAZGEÇ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BAŞARI KUTLAMA MODALI */}
      {showSuccessModal && lastDonatedAd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowSuccessModal(false)}></div>
          <div className="bg-white w-full max-w-sm rounded-[4rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Konfeti Efekti Arkaplanı */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="absolute top-10 left-10 w-4 h-4 bg-rose-500 rounded-full animate-ping"></div>
              <div className="absolute bottom-20 right-10 w-6 h-6 bg-orange-400 rounded-full animate-bounce"></div>
              <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            </div>

            <div className="p-10 text-center relative">
              <div className="w-24 h-24 bg-rose-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-rose-200 rotate-6 group hover:rotate-12 transition-transform">
                <Heart className="text-white fill-current animate-pulse" size={48} />
              </div>
              
              <h3 className="text-3xl font-black tracking-tighter mb-4 leading-tight">Müthişsin!</h3>
              <p className="text-slate-500 font-bold mb-8 leading-relaxed">
                <span className="text-rose-500">"{lastDonatedAd.title}"</span> için 1 saatini bağışladın. İyilik zincirine bir halka daha ekledin.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setActiveChat({
                      opportunityId: lastDonatedAd.id,
                      volunteerId: user.uid,
                      providerId: lastDonatedAd.providerId,
                      title: lastDonatedAd.title,
                      volunteerName: user.displayName || user.email.split('@')[0],
                      providerName: lastDonatedAd.provider,
                      otherPartyName: lastDonatedAd.provider
                    });
                  }}
                  className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-sm shadow-xl hover:bg-rose-500 transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare size={18} />
                  İLAN SAHİBİNE MESAJ AT
                </button>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full py-4 text-slate-400 font-black text-xs hover:text-slate-600 transition-colors uppercase tracking-widest"
                >
                  KAPAT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING AUTH MODAL (Giriş Yapılmamışsa) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAuthModal(false)}></div>
          <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl relative z-10 p-10 overflow-hidden animate-in zoom-in-95">
            <div className="text-center mb-8">
              <div className="bg-rose-500 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-6 shadow-xl shadow-rose-100">
                <Heart className="text-white fill-current" size={24} />
              </div>
              <h3 className="text-3xl font-black tracking-tighter">{authMode === 'login' ? 'Hoş Geldin' : 'Kayıt Ol'}</h3>
              <p className="text-slate-400 text-sm font-bold mt-1">İyiliğe bir adım uzaktasın.</p>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <input
                  type="text"
                  placeholder="Ad Soyad"
                  className="w-full p-4 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold placeholder:text-slate-300"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              )}
              <input
                type="email"
                placeholder="E-posta"
                className="w-full p-4 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold placeholder:text-slate-300"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Şifre"
                className="w-full p-4 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold placeholder:text-slate-300"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit" className="w-full py-5 bg-rose-500 text-white rounded-[2rem] font-black text-lg shadow-xl shadow-rose-100 hover:bg-rose-600 active:scale-95 transition-all">
                {authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
              </button>
            </form>
            <button
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="w-full text-center mt-8 text-[10px] font-black text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-[0.2em]"
            >
              {authMode === 'login' ? 'Hesabın yok mu? Kayıt Ol' : 'Zaten hesabın var mı? Giriş Yap'}
            </button>
          </div>
        </div>
      )}

      {/* YENİ İLAN MODAL */}
      {showAdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAdModal(false)}></div>
          <form onSubmit={handleCreateAd} className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-rose-500 p-10 text-white relative">
              <button type="button" onClick={() => setShowAdModal(false)} className="absolute top-8 right-8 p-2 hover:bg-white/20 rounded-full transition-colors">
                <X size={24} />
              </button>
              <h3 className="text-3xl font-black tracking-tighter italic">1 Saatini Paylaş</h3>
              <p className="text-rose-100 text-sm font-bold mt-1 uppercase tracking-widest opacity-80">Gönüllülük ilanı oluştur</p>
            </div>

            <div className="p-10 space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 mb-2 block">Başlık</label>
                <input
                  required
                  className="w-full p-4 bg-slate-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                  placeholder="Örn: Gitar Dersi Verilir"
                  onChange={(e) => setNewAd({ ...newAd, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 mb-2 block">Kategori</label>
                  <select
                    className="w-full p-4 bg-slate-50 border-0 rounded-2xl outline-none font-bold text-sm appearance-none"
                    onChange={(e) => setNewAd({ ...newAd, category: e.target.value })}
                  >
                    <option>Eğitim</option>
                    <option>Çevre</option>
                    <option>Sosyal Destek</option>
                    <option>Teknoloji</option>
                    <option>Hayvan Hakları</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 mb-2 block">Zaman</label>
                  <input
                    required
                    placeholder="Örn: Pazar 14:00"
                    className="w-full p-4 bg-slate-50 border-0 rounded-2xl outline-none font-bold text-sm"
                    onChange={(e) => setNewAd({ ...newAd, time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 mb-2 block">Konum</label>
                <input
                  required
                  placeholder="Örn: Beşiktaş Meydan veya Zoom"
                  className="w-full p-4 bg-slate-50 border-0 rounded-2xl outline-none font-bold text-sm"
                  onChange={(e) => setNewAd({ ...newAd, location: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1 mb-2 block">Açıklama</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Nasıl yardımcı olacaksınız?"
                  className="w-full p-4 bg-slate-50 border-0 rounded-2xl outline-none font-medium text-sm resize-none"
                  onChange={(e) => setNewAd({ ...newAd, description: e.target.value })}
                ></textarea>
              </div>
              <button type="submit" className="w-full py-5 bg-rose-500 text-white rounded-[2rem] font-black text-xl shadow-xl shadow-rose-100 hover:bg-rose-600 active:scale-95 transition-all mt-4">
                YAYINLA
              </button>
            </div>
          </form>
        </div>
      )}

      {/* WIDGET CHAT UI */}
      {user && (
        <div className={`fixed bottom-6 right-6 z-[60] flex flex-col items-end transition-all duration-300 ${isChatListOpen || (activeChat && !isChatMinimized) ? 'w-[90vw] sm:w-[400px]' : 'w-auto'}`}>
          
          {/* Active Chat Window */}
          {activeChat && !isChatMinimized && (
            <div className="bg-white w-full h-[550px] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 slide-in-from-bottom-10 duration-300 mb-4">
              {/* Header */}
              <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <button onClick={() => { setActiveChat(null); setIsChatListOpen(true); }} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                    <ChevronLeft size={20} />
                  </button>
                  <div className="w-10 h-10 bg-rose-500 rounded-2xl flex items-center justify-center text-white text-xs font-black shadow-lg shadow-rose-500/20">
                    {(activeChat.otherPartyName || 'G')[0]}
                  </div>
                  <div className="flex flex-col">
                    <h4 className="font-black text-sm leading-none">{activeChat.otherPartyName}</h4>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[150px]">{activeChat.title}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* SAĞLAYICI İÇİN GÖNÜLLÜYÜ ÇIKAR BUTONU */}
                  {activeChat.isProvider && (
                    <button 
                       onClick={() => handleRemoveVolunteer(activeChat.opportunityId, activeChat.otherPartyId)}
                       className="p-2.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 rounded-xl transition-all"
                       title="Gönüllüyü İlandan Çıkar"
                    >
                      <UserMinus size={18} />
                    </button>
                  )}
                  <button onClick={() => setIsChatMinimized(true)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><Minus size={18} /></button>
                  <button onClick={() => setActiveChat(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={18} /></button>
                </div>
              </div>
              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs font-bold shadow-sm ${msg.senderId === user?.uid ? 'bg-rose-500 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'}`}>
                      {msg.text}
                      <div className={`text-[7px] mt-1 font-black uppercase opacity-50 ${msg.senderId === user?.uid ? 'text-white' : 'text-slate-400'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-5 bg-white border-t border-slate-100 flex gap-2">
                <input autoFocus type="text" placeholder="Mesajını yaz..." className="flex-1 bg-slate-50 border-0 p-3 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-xs" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                <button type="submit" disabled={!newMessage.trim()} className="bg-rose-500 text-white p-3 rounded-xl shadow-lg shadow-rose-100"><Send size={18} /></button>
              </form>
            </div>
          )}

          {/* Chat List Drawer */}
          {isChatListOpen && !activeChat && (
            <div className="bg-white w-full h-[550px] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 slide-in-from-bottom-10 duration-300 mb-4">
              <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                <h4 className="font-black text-lg italic tracking-tighter">MESAJLARIM</h4>
                <button onClick={() => setIsChatListOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                {chatList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                    <MessageSquare size={40} className="mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Henüz mesaj yok</p>
                  </div>
                ) : (
                  chatList.map((chat) => (
                    <div 
                      key={chat.id} 
                      onClick={() => setActiveChat({
                        opportunityId: chat.opportunityId,
                        volunteerId: chat.volunteerId,
                        providerId: chat.providerId,
                        title: chat.opportunityTitle,
                        otherPartyName: user.uid === chat.volunteerId ? chat.providerName : chat.volunteerName
                      })}
                      className={`bg-white p-4 rounded-3xl border transition-all cursor-pointer flex items-center justify-between group ${chat.lastSenderId !== user.uid && hasNewMessageNotification ? 'border-rose-400 bg-rose-50/30' : 'border-slate-100 hover:border-rose-200 shadow-sm'}`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 bg-slate-900 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-sm">
                          {(user.uid === chat.volunteerId ? chat.providerName : chat.volunteerName)?.[0].toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-[8px] font-black text-rose-500 uppercase truncate">{chat.opportunityTitle}</p>
                          <h5 className="font-black text-slate-800 text-sm truncate">{user.uid === chat.volunteerId ? chat.providerName : chat.volunteerName}</h5>
                          <p className="text-[10px] font-medium text-slate-400 truncate">{chat.lastMessage}</p>
                        </div>
                      </div>
                      {chat.lastSenderId !== user.uid && (
                        <div className="w-2 h-2 bg-rose-500 rounded-full flex-shrink-0 animate-pulse"></div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Floating Toggle Button */}
          {!activeChat || isChatMinimized ? (
            <button 
              onClick={() => {
                if (isChatMinimized) setIsChatMinimized(false);
                else setIsChatListOpen(!isChatListOpen);
              }}
              className="bg-slate-900 text-white p-5 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center gap-3 group relative"
            >
              {(hasNewMessageNotification || (activeChat && isChatMinimized)) && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black animate-bounce">!</span>
              )}
              <MessageSquare size={24} />
              <span className="font-bold text-sm hidden group-hover:block pr-2">
                {activeChat ? activeChat.otherPartyName : 'Sohbetler'}
              </span>
            </button>
          ) : null}
        </div>
      )}

    </div>
  );
};

export default App;