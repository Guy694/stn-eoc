// ลงทะเบียน Chart.js ครั้งเดียวสำหรับกราฟในหน้าภาพรวม EOC อุทกภัย
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);
