"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AppIcon from "@/components/icons/AppIcon";
import { showError, showSuccess } from "@/lib/sweetAlert";

export default function UploadInfographics() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const [formData, setFormData] = useState({
        eocType: 'flood',
        files: []
    });

    const [existingFiles, setExistingFiles] = useState({});

    const eocTypes = [
        { value: 'flood', label: 'อุทกภัยน้ำท่วม', icon: "droplet" },
        { value: 'drought', label: 'ภัยแล้ง', icon: "sun" },
        { value: 'tsunami', label: 'คลื่นสึนามิ', icon: "waves" },
        { value: 'earthquake', label: 'แผ่นดินไหว', icon: "earth" },
        { value: 'disease', label: 'โรคระบาด', icon: "biohazard" }
    ];

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('/stn-eoc/api/auth/session/');
                if (!response.ok) {
                    router.push('/login');
                    return;
                }
                const data = await response.json();
                if (!data.success || data.user.role !== 'admin') {
                    router.push('/dashboard');
                    return;
                }
                setUser(data.user);
                fetchExistingFiles();
            } catch (error) {
                console.error('Auth error:', error);
                router.push('/login');
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [router]);

    const fetchExistingFiles = async () => {
        try {
            const response = await fetch('/stn-eoc/api/admin/infographics/list');
            if (response.ok) {
                const data = await response.json();
                setExistingFiles(data.files || {});
            }
        } catch (error) {
            console.error('Error fetching files:', error);
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        setFormData({ ...formData, files });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.files.length === 0) {
            showError('กรุณาเลือกไฟล์รูปภาพ');
            return;
        }

        setUploading(true);
        try {
            const uploadFormData = new FormData();
            uploadFormData.append('eocType', formData.eocType);

            formData.files.forEach((file) => {
                uploadFormData.append('files', file);
            });

            const response = await fetch('/stn-eoc/api/admin/infographics/upload', {
                method: 'POST',
                body: uploadFormData
            });

            const data = await response.json();

            if (data.success) {
                showSuccess('อัปโหลดสำเร็จ!');
                setFormData({ ...formData, files: [] });
                document.getElementById('fileInput').value = '';
                fetchExistingFiles();
            } else {
                showError(data.message || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Upload error:', error);
            showError('เกิดข้อผิดพลาดในการอัปโหลด');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (eocType, filename) => {
        if (!confirm('ต้องการลบไฟล์นี้หรือไม่?')) return;

        try {
            const response = await fetch('/stn-eoc/api/admin/infographics/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eocType, filename })
            });

            const data = await response.json();

            if (data.success) {
                showSuccess('ลบไฟล์สำเร็จ');
                fetchExistingFiles();
            } else {
                showError(data.message || 'เกิดข้อผิดพลาดในการลบ');
            }
        } catch (error) {
            console.error('Delete error:', error);
            showError('เกิดข้อผิดพลาดในการลบ');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b border-blue-600 mx-auto mb-4"></div>
                    <p>กำลังโหลด...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="container mx-auto px-4 max-w-6xl">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800 mb-2"><AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> อัปโหลด Infographics</h1>
                            <p className="text-gray-600">สำหรับฝ่าย Risk Communication</p>
                        </div>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
                        >
                            ← กลับ
                        </button>
                    </div>
                </div>

                {/* Upload Form */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">อัปโหลดรูปภาพ Infographic</h2>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* EOC Type Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                เลือกประเภท EOC
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                {eocTypes.map((type) => (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, eocType: type.value })}
                                        className={`p-4 rounded-lg border-2 transition-all ${formData.eocType === type.value
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <AppIcon icon={type.icon} className="mx-auto mb-2 h-8 w-8" />
                                        <div className="text-sm font-medium">{type.label}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* File Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                เลือกไฟล์รูปภาพ (PNG, JPG, JPEG)
                            </label>
                            <input
                                id="fileInput"
                                type="file"
                                accept="image/png,image/jpeg,image/jpg"
                                multiple
                                onChange={handleFileChange}
                                className="block w-full text-sm text-blue-900 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                * สามารถเลือกหลายไฟล์พร้อมกันได้
                            </p>
                            {formData.files.length > 0 && (
                                <div className="mt-3 text-sm text-gray-600">
                                    เลือกแล้ว {formData.files.length} ไฟล์: {formData.files.map(f => f.name).join(', ')}
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={uploading || formData.files.length === 0}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                        >
                            {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
                        </button>
                    </form>
                </div>

                {/* Existing Files */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">ไฟล์ Infographic ที่มีอยู่</h2>

                    {Object.keys(existingFiles).length === 0 ? (
                        <p className="text-gray-500 text-center py-8">ยังไม่มีไฟล์</p>
                    ) : (
                        <div className="space-y-6">
                            {eocTypes.map((type) => {
                                const files = existingFiles[type.value] || [];
                                if (files.length === 0) return null;

                                return (
                                    <div key={type.value} className="border-b pb-6 last:border-b-0">
                                        <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                            <AppIcon icon={type.icon} className="h-7 w-7" />
                                            {type.label} ({files.length} ไฟล์)
                                        </h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {files.map((file, idx) => (
                                                <div key={idx} className="relative group">
                                                    <Image
                                                        src={`/stn-eoc/infographics/${type.value}/${file}`}
                                                        alt={file}
                                                        width={320}
                                                        height={160}
                                                        className="w-full h-40 object-cover rounded-lg border shadow-sm"
                                                        unoptimized
                                                    />
                                                    <div className="mt-2 text-xs text-gray-600 truncate">{file}</div>
                                                    <button
                                                        onClick={() => handleDelete(type.value, file)}
                                                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="ลบ"
                                                    >
                                                        <AppIcon icon="trash" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
