import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { supabase } from '../lib/supabaseClient';

export default function LeadDetailScreen({ route, navigation }) {
  const { lead } = route.params;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: lead.name || '',
    email: lead.email || '',
    phone: lead.phone || '',
    insurance: lead.insurance || '',
    birthday: lead.birthday || '',
    address_line1: lead.address_line1 || '',
    city: lead.city || '',
    state: lead.state || '',
    zip_code: lead.zip_code || '',
    shipping_duration: lead.shipping_duration || '',
  });

  const handleCallPhone = () => {
    if (!formData.phone) {
      Alert.alert('No Phone', 'This lead has no phone number');
      return;
    }
    Linking.openURL(`tel:${formData.phone}`).catch(() => {
      Alert.alert('Error', 'Unable to open phone dialer');
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update(formData)
        .eq('id', lead.id);

      if (error) throw error;

      Alert.alert('Success', 'Lead updated successfully');
      setEditing(false);
      
      // Update the lead object for next time
      Object.assign(lead, formData);
    } catch (error) {
      Alert.alert('Error', 'Failed to update lead: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data
    setFormData({
      name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      insurance: lead.insurance || '',
      birthday: lead.birthday || '',
      address_line1: lead.address_line1 || '',
      city: lead.city || '',
      state: lead.state || '',
      zip_code: lead.zip_code || '',
      shipping_duration: lead.shipping_duration || '',
    });
    setEditing(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const renderField = (label, value, key, multiline = false) => {
    if (editing) {
      return (
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={[styles.input, multiline && styles.inputMultiline]}
            value={formData[key]}
            onChangeText={(text) => setFormData({ ...formData, [key]: text })}
            placeholder={`Enter ${label.toLowerCase()}`}
            multiline={multiline}
            autoCapitalize={key === 'email' ? 'none' : 'words'}
            keyboardType={key === 'phone' ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'}
          />
        </View>
      );
    }

    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value || 'Not set'}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lead Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Quick Actions */}
        {!editing && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.callButton} onPress={handleCallPhone}>
              <Text style={styles.callButtonText}>📞 Call {formData.phone || 'N/A'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Patient Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Information</Text>
          {renderField('Name', formData.name, 'name')}
          {renderField('Email', formData.email, 'email')}
          {renderField('Phone', formData.phone, 'phone')}
          {renderField('Birthday', editing ? formData.birthday : formatDate(formData.birthday), 'birthday')}
          {renderField('Insurance', formData.insurance, 'insurance')}
        </View>

        {/* Address Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          {renderField('Street Address', formData.address_line1, 'address_line1')}
          {renderField('City', formData.city, 'city')}
          {renderField('State', formData.state, 'state')}
          {renderField('ZIP Code', formData.zip_code, 'zip_code')}
        </View>

        {/* Shipping Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipping</Text>
          {renderField('Shipping Duration', formData.shipping_duration || 'Not set', 'shipping_duration')}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {editing ? (
            <>
              <TouchableOpacity
                style={[styles.button, styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
                disabled={saving}
              >
                <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.editButton]}
              onPress={() => setEditing(true)}
            >
              <Text style={styles.buttonText}>Edit Lead</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 16,
    color: '#2563eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  actionsContainer: {
    marginBottom: 16,
  },
  callButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  callButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 6,
  },
  value: {
    fontSize: 16,
    color: '#333',
  },
  input: {
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    marginTop: 8,
    marginBottom: 32,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#16a34a',
  },
  editButton: {
    backgroundColor: '#2563eb',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#666',
  },
});
