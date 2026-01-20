import React, { useEffect, useRef, useState } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    SafeAreaView, 
    PermissionsAndroid,
    Platform,
    Alert,
    StatusBar
} from 'react-native';
import { 
    createAgoraRtcEngine, 
    ChannelProfileType, 
    RtcSurfaceView,
    ClientRoleType,
    IRtcEngine,
    VideoSourceType,
    RenderModeType
} from 'react-native-agora';

const APP_ID = '26bc7e0971794a43bb50854e986ae4fd'; // Kendi App ID'nizi buraya koyun
const TEMP_TOKEN = ''; // Token kullanıyorsanız buraya ekleyin, yoksa null/boş string

export default function CallScreen({ route, navigation }: any) {
    const { channelName, isHost } = route.params;

    const agoraEngineRef = useRef<IRtcEngine | null>(null);
    const [joined, setJoined] = useState(false);
    
    // Bağlantı Durumları
    const [activeRemoteUid, setActiveRemoteUid] = useState<number | null>(null);
    const [incomingRequestUid, setIncomingRequestUid] = useState<number | null>(null);

    // Medya Kontrolleri
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isCameraFront, setIsCameraFront] = useState(true);

    useEffect(() => {
        init();
        return () => {
            destroy();
        };
    }, []);

    // --- Başlatma ve İzinler ---
    const init = async () => {
        if (Platform.OS === 'android') {
            await requestAndroidPermissions();
        }
        await setupAgora();
    };

    const requestAndroidPermissions = async () => {
        try {
            await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                PermissionsAndroid.PERMISSIONS.CAMERA,
            ]);
        } catch (err) {
            console.warn(err);
        }
    };

    const setupAgora = async () => {
        try {
            const engine = createAgoraRtcEngine();
            agoraEngineRef.current = engine;

            engine.initialize({ appId: APP_ID });

            // Host kontrol mekanizması için varsayılan olarak herkesi susturuyoruz
            engine.muteAllRemoteAudioStreams(true);
            engine.muteAllRemoteVideoStreams(true);

            // --- Event Listenerlar ---
            
            // 1. Yerel kullanıcı katıldı
            engine.addListener('onJoinChannelSuccess', (_connection, uid) => {
                console.log('Local kullanıcı kanala girdi:', uid);
                setJoined(true);
            });

            // 2. Uzak kullanıcı katıldı
engine.addListener('onUserJoined', (_connection, uid) => {
    console.log("Remote kullanıcı geldi:", uid);

    if (isHost) {
        setIncomingRequestUid(uid);
        
        // ÖNEMLİ: Popup'ta görebilmek için videoyu hemen açmamız lazım!
        // Sesi kapalı tutabilirsin (false yaparsan sesini de duyarsın)
        engine.muteRemoteVideoStream(uid, false); 
        engine.muteRemoteAudioStream(uid, true); // İstersen sesi duymamak için true bırak
    } else {
        // Misafir ise... (eski mantık aynı)
        setActiveRemoteUid(uid);
        engine.muteRemoteVideoStream(uid, false);
        engine.muteRemoteAudioStream(uid, false);
    }
});

            // 3. Uzak kullanıcı çıktı
     // ... setupAgora fonksiyonunun içi ...

// 3. Uzak kullanıcı çıktı
engine.addListener('onUserOffline', (_connection, uid) => {
    console.log("Kullanıcı çıktı:", uid);

    // EĞER MİSAFİRSEK: Host çıktığında biz de çıkalım
    if (!isHost) {
        Alert.alert("Görüşme Sona Erdi", "Host yayını sonlandırdı.", [
            { 
                text: "Tamam", 
                onPress: () => {
                    destroy();
                    navigation.goBack(); 
                }
            }
        ]);
        return; // Fonksiyonu burada kesiyoruz
    }

    // EĞER HOSTSAK: Misafir çıktığında sadece ekranı temizle (Host odada kalmaya devam edebilir veya istersen o da çıksın)
    if (activeRemoteUid === uid) setActiveRemoteUid(null);
    if (incomingRequestUid === uid) setIncomingRequestUid(null);
    Alert.alert("Kullanıcı Ayrıldı", "Misafir " + uid + " ayrıldı.");
});

            // --- Ayarlar ---
            engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
            engine.enableVideo();
            engine.startPreview();

            // Hoparlörü zorla aç (Ahize yerine hoparlör kullanımı için)
            engine.setEnableSpeakerphone(true); 

            // Kanala Katıl
            engine.joinChannel(TEMP_TOKEN, channelName, 0, {
                clientRoleType: ClientRoleType.ClientRoleBroadcaster
            });

        } catch (e) {
            console.error("Agora Error:", e);
            Alert.alert("Hata", "Görüntülü görüşme başlatılamadı.");
        }
    };

    const destroy = () => {
        
        try {
            agoraEngineRef.current?.leaveChannel();
            agoraEngineRef.current?.removeAllListeners();
            agoraEngineRef.current?.release();
            console.log("Agora engine destroyed");
        } catch (e) {
            console.error(e);
        }
    };

    const leave = () => {
        destroy();
        navigation.goBack();
    };

    // --- Host Onay İşlemleri ---
    const handleApprove = () => {
        if (incomingRequestUid !== null && agoraEngineRef.current) {
            // İzin verilen kullanıcının ses ve videosunu aç
            agoraEngineRef.current.muteRemoteVideoStream(incomingRequestUid, false);
            agoraEngineRef.current.muteRemoteAudioStream(incomingRequestUid, false);

            setActiveRemoteUid(incomingRequestUid);
            setIncomingRequestUid(null);
        }
    };

   const handleReject = () => {
    setIncomingRequestUid(null);
    agoraEngineRef.current?.leaveChannel();
};


    // --- Medya Kontrolleri ---
    const toggleMic = () => {
        if (agoraEngineRef.current) {
            agoraEngineRef.current.muteLocalAudioStream(!isMicMuted);
            setIsMicMuted(!isMicMuted);
        }
    };

    const switchCamera = () => {
        if (agoraEngineRef.current) {
            agoraEngineRef.current.switchCamera();
            setIsCameraFront(!isCameraFront);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#111" />
            
            {/* --- Header --- */}
            <View style={styles.header}>
                <Text style={styles.channelText}>Oda: {channelName}</Text>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{isHost ? 'HOST' : 'MİSAFİR'}</Text>
                </View>
            </View>

            {/* --- Video Alanı --- */}
            <View style={styles.videoContainer}>
                
                {/* Uzak Kullanıcı Videosu (Full Ekran) */}
                {activeRemoteUid !== null ? (
                    <RtcSurfaceView 
                        canvas={{ uid: activeRemoteUid, renderMode: RenderModeType.RenderModeHidden }} 
                        style={styles.fullScreen} 
                    />
                ) : (
                    // Bağlı kimse yoksa bekleme ekranı
                    <View style={styles.waitingContainer}>
                        <Text style={styles.waitingText}>
                            {isHost ? 'Kullanıcı bekleniyor...' : 'Host bekleniyor...'}
                        </Text>
                        <Text style={styles.waitingSubText}>
                            {joined ? 'Bağlantı kuruldu' : 'Bağlanılıyor...'}
                        </Text>
                    </View>
                )}

                {/* Yerel Kullanıcı (Ben) - Küçük Ekran */}
                {joined && (
                    <View style={styles.localVideoFloating}>
                        <RtcSurfaceView 
                            canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }} 
                            style={styles.fullScreen} 
                            zOrderMediaOverlay={true} // Bu Android'de üstte kalmasını sağlar
                        />
                        <View style={styles.localLabel}>
                            <Text style={styles.localLabelText}>Ben</Text>
                        </View>
                    </View>
                )}

                {/* Host İçin Onay Popup'ı */}
               {isHost && incomingRequestUid !== null && (
    <View style={styles.popupOverlay}>
        <View style={styles.popupBox}>
            <Text style={styles.popupTitle}>Görüşme İsteği</Text>
            
            <View style={styles.popupVideoWrapper}>
                <RtcSurfaceView
                    canvas={{ uid: incomingRequestUid, renderMode: 1 }} // 1 = Hidden (Cover)
                    style={styles.popupVideo}
                    zOrderMediaOverlay={true} // Popup üstünde görünmesi için şart!
                />
            </View>

            <Text style={styles.popupDesc}>
                Bir kullanıcı bağlanmak istiyor.
            </Text>
            
            <View style={styles.popupButtons}>
                <TouchableOpacity onPress={handleReject} style={[styles.btn, styles.btnReject]}>
                    <Text style={[styles.btnText, {color: '#d32f2f'}]}>Reddet</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleApprove} style={[styles.btn, styles.btnApprove]}>
                    <Text style={styles.btnText}>Kabul Et</Text>
                </TouchableOpacity>
            </View>
        </View>
    </View>
)}
            </View>

            {/* --- Kontrol Paneli --- */}
            <View style={styles.controls}>
                
               {/*  {/* Mikrofon */}
               {/*  <TouchableOpacity onPress={toggleMic} style={[styles.controlBtn, isMicMuted && styles.controlBtnActive]}>
                    <Text style={styles.controlIcon}>{isMicMuted ? '🔇' : '🎤'}</Text>
                </TouchableOpacity> */}

                {/* Aramayı Bitir */}
                <TouchableOpacity onPress={leave} style={styles.endCallBtn}>
                    <Text style={styles.endCallText}>Aramayı Bitir</Text>
                </TouchableOpacity>

                {/* Kamera Çevir */}
              {/*   <TouchableOpacity onPress={switchCamera} style={styles.controlBtn}>
                    <Text style={styles.controlIcon}>📷</Text>
                </TouchableOpacity>
 */}
            </View>
        </SafeAreaView>
    );
    
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#111' },
    
    // Header
    header: { 
        position: 'absolute', top: 50, left: 0, right: 0, zIndex: 100,
        flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, alignItems: 'center'
    },
    channelText: { color: 'white', fontSize: 18, fontWeight: 'bold', textShadowColor: 'black', textShadowRadius: 5 },
    badge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
    badgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },

    // Video Container
    videoContainer: { flex: 1, position: 'relative', backgroundColor: '#222' },
    fullScreen: { flex: 1, width: '100%', height: '100%' },

    // Waiting Screen
    waitingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    waitingText: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    waitingSubText: { color: '#888', fontSize: 14 },

    // Local Video (Küçük Pencere)
    localVideoFloating: {
        position: 'absolute',
        bottom: 70,
        right: 5,
        width: 150,
        height: 250,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        overflow: 'hidden',
        zIndex: 50,
        elevation: 10,
        backgroundColor: '#000'
    },
    localLabel: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.6)', padding: 3, borderRadius: 3 },
    localLabelText: { color: 'white', fontSize: 10 },

    // Popup (Modal)
    popupOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 200
    },
    popupBox: {
        width: '85%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        elevation: 20
    },
    popupTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#333' },
    popupDesc: { fontSize: 15, color: '#666', marginBottom: 24, textAlign: 'center' },
    popupButtons: { flexDirection: 'row', width: '100%', gap: 12 },
    btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    btnReject: { backgroundColor: '#FFEDEF' },
    btnApprove: { backgroundColor: '#00C851' },
    btnText: { color: 'white', fontWeight: '600', fontSize: 16 },

    // Reject Text Color Adjustment
    
    // Alt Kontroller
    controls: { 
        position: 'absolute', bottom: 40, left: 0, right: 0,
        flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', 
        zIndex: 100 
    },
    controlBtn: { 
        width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', 
        justifyContent: 'center', alignItems: 'center' 
    },
    controlBtnActive: { backgroundColor: 'white' },
    controlIcon: { fontSize: 22 },
    endCallBtn: { 
        backgroundColor: '#FF4444', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 30,
        shadowColor: '#FF4444', shadowOpacity: 0.4, shadowRadius: 10, elevation: 5
    },
    endCallText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    // ... diğer stiller
    popupVideoWrapper: {
        width: '100%',
        height: 200,          // Videonun yüksekliği
        backgroundColor: '#000',
        borderRadius: 12,
        overflow: 'hidden',   // Köşelerin yuvarlak kalması için
        marginBottom: 15,     // Yazı ile arasına boşluk
    },
    popupVideo: {
        width: '100%',
        height: '100%',
    },
    // ...
});