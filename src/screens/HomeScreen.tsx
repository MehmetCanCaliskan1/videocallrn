import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';

type RootStackParamList = {
    Home: undefined;
    CallScreen: { channelName: string; isHost: boolean };
};

export default function HomeScreen() {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();
    const [channelName, setChannelName] = useState('');
    const [isHost, setIsHost] = useState(true); 

    const joinChannel = () => {
        if (channelName.trim() === '') return;
        
        navigation.navigate('CallScreen', { 
            channelName: channelName,
            isHost: isHost 
        });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>HOŞ GELDİNİZ</Text>
            
            <Text style={styles.label}>Kanal Adı Giriniz:</Text>
            <TextInput 
                style={styles.input} 
                placeholder="Örn: testChannel"
                value={channelName}
                onChangeText={setChannelName}
            />

            <View style={styles.switchContainer}>
                <Text style={styles.label}>Host Ol:</Text>
                <Switch 
                    value={isHost} 
                    onValueChange={setIsHost} 
                />
            </View>
            

            <TouchableOpacity style={styles.joinButton} onPress={joinChannel}>
                <Text style={styles.buttonText}>Odaya Gir</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f5f5' },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 40 },
    label: { fontSize: 16, marginBottom: 5, fontWeight: '600' },
    input: { backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#ddd' },
    switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    joinButton: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, alignItems: 'center' },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});